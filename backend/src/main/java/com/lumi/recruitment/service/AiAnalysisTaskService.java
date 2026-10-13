package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.ApplicationAiStatusDto;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor
public class AiAnalysisTaskService {
    private final JdbcTemplate jdbc;
    private final ApplicationAiEvaluator evaluator;
    private final UserRepository users;
    @Value("${app.ai-analysis.max-attempts:3}") private int configuredAttempts;
    @Value("${app.ai-service.timeout-seconds:60}") private int timeout;
    public record Task(UUID id,UUID applicationId,UUID leaseToken,int attempts) {}
    public int maxAttempts() {return Math.max(1,Math.min(5,configuredAttempts));}
    @Transactional public void enqueue(UUID application) {
        jdbc.update("insert into recruitment.ai_analysis_tasks(application_id) values(?) on conflict(application_id) do nothing",application);
    }
    public Task claim() {
        jdbc.update("update recruitment.ai_analysis_tasks set status='FAILED',lease_token=null,lease_until=null,last_error_code='LEASE_EXHAUSTED',updated_at=now() where status='PROCESSING' and lease_until<now() and attempts>=?",maxAttempts());
        var token=UUID.randomUUID();
        return jdbc.query("""
            with due as (
              select id from recruitment.ai_analysis_tasks
              where attempts<? and ((status='PENDING' and next_attempt_at<=now()) or (status='PROCESSING' and lease_until<now()))
              order by next_attempt_at,created_at,id for update skip locked limit 1
            ) update recruitment.ai_analysis_tasks t set status='PROCESSING',attempts=t.attempts+1,
              lease_token=?,lease_until=now()+(? * interval '1 second'),updated_at=now()
            from due where t.id=due.id returning t.id,t.application_id,t.attempts
            """,(rs,n)->new Task(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),token,rs.getInt(3)),maxAttempts(),token,Math.max(120,timeout+30))
            .stream().findFirst().orElse(null);
    }
    public void process(Task task) {
        try {
            if(!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.ai_analysis_tasks where id=? and status='PROCESSING' and lease_token=? and lease_until>now())",Boolean.class,task.id(),task.leaseToken()))) return;
            var allowed=jdbc.queryForObject("select a.status<>'WITHDRAWN' and u.status='ACTIVE' from recruitment.applications a join auth.users u on u.id=a.candidate_id where a.id=?",Boolean.class,task.applicationId());
            if(!Boolean.TRUE.equals(allowed)) {skip(task);return;}
            // The evaluator reuses a valid CV/job match or completed assessment before calling AI.
            evaluator.evaluate(task.applicationId(),false);
        } catch(Exception error) {fail(task,error);}
    }
    private void skip(Task task) {
        jdbc.update("update recruitment.ai_analysis_tasks set status='SKIPPED',lease_token=null,lease_until=null,last_error_code='INELIGIBLE',updated_at=now() where id=? and status='PROCESSING' and lease_token=?",task.id(),task.leaseToken());
    }
    public void fail(Task task,Exception error) {
        int status=error instanceof ResponseStatusException e?e.getStatusCode().value():500;
        if(status==409 || status==429) {
            jdbc.update("update recruitment.ai_analysis_tasks set status='PENDING',attempts=greatest(0,attempts-1),next_attempt_at=now()+interval '30 seconds',lease_token=null,lease_until=null,last_error_code='BUSY',updated_at=now() where id=? and status='PROCESSING' and lease_token=?",task.id(),task.leaseToken());
            return;
        }
        boolean terminal=task.attempts()>=maxAttempts() || (status>=400 && status<500);
        jdbc.update("update recruitment.ai_analysis_tasks set status=?,next_attempt_at=now()+(? * interval '1 second'),lease_token=null,lease_until=null,last_error_code=?,updated_at=now() where id=? and status='PROCESSING' and lease_token=?",
            terminal?"FAILED":"PENDING",task.attempts()<=1?15:60,status==503?"AI_UNAVAILABLE":"ANALYSIS_FAILED",task.id(),task.leaseToken());
    }
    @Transactional(readOnly=true)
    public ApplicationAiStatusDto status(Authentication auth,UUID application) {
        if(auth==null) throw new BadCredentialsException("Hãy đăng nhập để tiếp tục.");
        var user=users.findByEmail(auth.getName()).filter(u->u.getStatus()==UserStatus.ACTIVE && u.getRole()==UserRole.CANDIDATE)
            .orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho ứng viên."));
        if(!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where id=? and candidate_id=?)",Boolean.class,application,user.getId())))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn ứng tuyển của bạn.");
        var result=jdbc.query("""
            select coalesce(t.status,'NOT_REQUESTED'),coalesce(t.attempts,0),t.next_attempt_at,
              a.score,a.summary,a.created_at
            from recruitment.applications app left join recruitment.ai_analysis_tasks t on t.application_id=app.id
            left join recruitment.ai_assessments a on a.id=t.result_assessment_id where app.id=?
            """,(rs,n)->new ApplicationAiStatusDto(rs.getString(1),rs.getInt(2),maxAttempts(),rs.getTimestamp(3)==null?null:rs.getTimestamp(3).toInstant(),
                rs.getObject(4,Integer.class),rs.getString(5),rs.getTimestamp(6)==null?null:rs.getTimestamp(6).toInstant()),application);
        return result.getFirst();
    }
}
