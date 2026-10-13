package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;

/** Internal worker/staff boundary. Controllers cannot invoke this without their own role checks. */
@Service @RequiredArgsConstructor
public class ApplicationAiEvaluator {
    private final JdbcTemplate jdbc;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;
    private final AssessmentContext contexts;
    private final Semaphore slots=new Semaphore(2);

    @Transactional
    public UUID evaluate(UUID id,boolean force) {
        if(!Boolean.TRUE.equals(jdbc.queryForObject("select pg_try_advisory_xact_lock(hashtextextended(?,0))",Boolean.class,"assessment:"+id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Hồ sơ này đang được phân tích. Hãy chờ kết quả.");
        var snapshot=jdbc.query("select a.job_snapshot::text,s.content::text,a.candidate_id::text,a.job_id::text,a.resume_id::text from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id where a.id=?",
            (rs,n)->new String[]{rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5)},id).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Chưa có CV đã nộp."));
        var input=contexts.input(mapper.readTree(snapshot[0]),mapper.readTree(snapshot[1]));
        if(!force) {
            var existing=jdbc.query("select id from recruitment.ai_assessments where application_id=? and input_hash=? and evaluation_version=? order by created_at desc,id desc limit 1",
                (rs,n)->rs.getObject(1,UUID.class),id,input.inputHash(),AssessmentContext.EVALUATION_VERSION);
            if(!existing.isEmpty()) {complete(id,existing.getFirst());return existing.getFirst();}
        }
        AiServiceResult result=force?null:fromMatch(id,snapshot,input);
        if(result==null) {
            if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau.");
            try {result=ai.assess(id.toString(),input.job().toString(),input.resume().toString());}
            finally {slots.release();}
        }
        AssessmentContext.validate(id,input,result);
        UUID assessment=UUID.randomUUID();
        jdbc.update("""
            insert into recruitment.ai_assessments(id,application_id,model_name,prompt_version,score,summary,matched_skills,missing_skills,gaps,interview_questions,job_context_hash,input_hash,evaluation_version,created_at)
            values(?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?,?)
            """,assessment,id,result.modelName(),result.promptVersion(),result.score(),result.summary(),mapper.writeValueAsString(result.matchedSkills()),
            mapper.writeValueAsString(result.missingSkills()),mapper.writeValueAsString(result.gaps()),mapper.writeValueAsString(result.interviewQuestions()),
            input.jobHash(),input.inputHash(),AssessmentContext.EVALUATION_VERSION,Timestamp.from(Instant.now()));
        for(var c:result.criteria()) jdbc.update("insert into recruitment.ai_assessment_criteria(id,assessment_id,criterion_key,skill,match_level,evidence,reason,points,weight) values(?,?,?,?,?,?,?,?,?)",
            UUID.randomUUID(),assessment,c.key(),c.skill(),c.matchLevel(),c.evidence(),c.reason(),c.points(),c.weight());
        complete(id,assessment);return assessment;
    }
    private void complete(UUID application,UUID assessment) {
        jdbc.update("update recruitment.ai_analysis_tasks set status='COMPLETED',result_assessment_id=?,lease_token=null,lease_until=null,last_error_code=null,updated_at=now() where application_id=?",assessment,application);
    }
    private AiServiceResult fromMatch(UUID id,String[] snapshot,AssessmentContext.Input input) {
        var rows=jdbc.query("""
            select assessment_payload::text from recruitment.candidate_job_matches
            where candidate_id=?::uuid and job_id=?::uuid and resume_id=?::uuid and input_hash=? and job_context_hash=? and evaluation_version=? and assessment_payload is not null
            """,(rs,n)->rs.getString(1),snapshot[2],snapshot[3],snapshot[4],input.inputHash(),input.jobHash(),AssessmentContext.EVALUATION_VERSION);
        if(rows.isEmpty()) return null;
        try {
            var cached=mapper.readValue(rows.getFirst(),AiServiceResult.class);
            var result=new AiServiceResult(id,cached.modelName(),cached.promptVersion(),cached.score(),cached.summary(),cached.matchedSkills(),cached.missingSkills(),cached.criteria(),cached.gaps(),cached.interviewQuestions());
            AssessmentContext.validate(id,input,result);return result;
        } catch(RuntimeException invalid) {return null;}
    }
}
