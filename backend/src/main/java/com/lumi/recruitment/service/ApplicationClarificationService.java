package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.ApplicationClarificationDto;
import com.lumi.recruitment.dto.ApplicationClarificationDto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;

@Service @RequiredArgsConstructor
public class ApplicationClarificationService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final ObjectMapper mapper;
    private final AssessmentContext contexts;
    private final AiServiceClient ai;
    private final PlatformTransactionManager transactions;
    private final Semaphore slots = new Semaphore(2);
    private static final Set<String> CLOSED = Set.of("HIRED","REJECTED","WITHDRAWN");
    private record Application(UUID owner, String status, JsonNode job, JsonNode resume) {}
    private record Assessment(UUID id, String inputHash, Instant createdAt) {}
    private record State(String state, UUID token, Instant leaseUntil, Instant retryAt, int attempts, Instant window) {}
    private record Target(String key, String requirement, boolean required, String matchLevel, String evidence, java.math.BigDecimal weight) {}
    private record Claim(UUID token, List<Target> targets, Object input) {}

    private Application authorize(Authentication auth, UUID id, boolean staff, boolean lock) {
        if(auth==null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        var user=users.findByEmail(auth.getName()).filter(u->u.getStatus()==UserStatus.ACTIVE)
            .orElseThrow(()->new BadCredentialsException("Phiên không còn hợp lệ."));
        if(staff ? user.getRole()!=UserRole.RECRUITER && user.getRole()!=UserRole.COMPANY_ADMIN : user.getRole()!=UserRole.CANDIDATE)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Bạn không có quyền thực hiện thao tác này.");
        var rows=jdbc.query("""
            select a.candidate_id,a.status,a.job_snapshot::text,
              case when a.submission_format='ORIGINAL_PDF' then
                coalesce(s.content->'pdfReviewedContent',d.parsed_content) else s.content end as resume
            from recruitment.applications a
            join recruitment.application_resume_snapshots s on s.application_id=a.id
            left join candidate.resume_documents d on d.id=a.source_document_id
            where a.id=?
            """+(lock?" for update of a":""), (r,n)->new Application(r.getObject(1,UUID.class),r.getString(2),
                mapper.readTree(r.getString(3)),r.getString(4)==null?mapper.createObjectNode():mapper.readTree(r.getString(4))),id);
        if(rows.isEmpty() || !staff && !rows.getFirst().owner().equals(user.getId()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy hồ sơ.");
        return rows.getFirst();
    }
    private Assessment latest(UUID id) {
        return jdbc.query("select id,input_hash,created_at from recruitment.ai_assessments where application_id=? and evaluation_version=? order by created_at desc,id desc limit 1",
            (r,n)->new Assessment(r.getObject(1,UUID.class),r.getString(2),r.getTimestamp(3).toInstant()),id,AssessmentContext.EVALUATION_VERSION).stream().findFirst().orElse(null);
    }
    private State state(UUID id) {
        return jdbc.query("select * from recruitment.application_clarification_sets where application_id=?",
            (r,n)->new State(r.getString("state"),r.getObject("lease_token",UUID.class),instant(r,"lease_until"),instant(r,"retry_at"),r.getInt("attempts"),instant(r,"window_started_at")),id).stream().findFirst().orElse(null);
    }
    private static Instant instant(ResultSet r,String column) throws SQLException {
        var value=r.getTimestamp(column);return value==null?null:value.toInstant();
    }
    private static boolean working(State s) {return s!=null && s.state().equals("GENERATING") && s.leaseUntil().isAfter(Instant.now());}
    private static Instant retryAt(State s) {
        if(s==null) return null;
        Instant retry=s.retryAt();
        if(s.attempts()>=3 && s.window().plusSeconds(3600).isAfter(retry)) retry=s.window().plusSeconds(3600);
        if(working(s) && s.leaseUntil().isAfter(retry)) retry=s.leaseUntil();
        return retry;
    }
    public ApplicationClarificationDto get(Authentication auth,UUID id,boolean staff) {
        return new TransactionTemplate(transactions).execute(tx->view(id,authorize(auth,id,staff,false),staff));
    }
    private ApplicationClarificationDto view(UUID id,Application app,boolean staff) {
        var state=state(id); var assessment=latest(id); boolean editable=!staff && !CLOSED.contains(app.status());
        boolean eligible=assessment!=null && contexts.input(app.job(),app.resume()).inputHash().equals(assessment.inputHash());
        String pending=jdbc.query("select status from recruitment.ai_analysis_tasks where application_id=?",(r,n)->r.getString(1),id).stream().findFirst().orElse("");
        boolean priorAnalysis=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.ai_assessments where application_id=?)",Boolean.class,id));
        String unavailable=Set.of("PENDING","PROCESSING").contains(pending)?"WAITING":priorAnalysis || Set.of("FAILED","SKIPPED","COMPLETED").contains(pending)?"NEEDS_ANALYSIS":"WAITING";
        String label=state==null?(assessment==null?"WAITING":"NOT_REQUESTED"):
            state.state().equals("GENERATING") && !working(state)?"FAILED":state.state();
        if(!eligible && !Set.of("READY","NOT_NEEDED","GENERATING").contains(label)) label=unavailable;
        Instant retry=retryAt(state);
        boolean canGenerate=editable && eligible && !working(state) && !Set.of("READY","NOT_NEEDED").contains(label)
            && (retry==null || !retry.isAfter(Instant.now()));
        var questions=jdbc.query("select * from recruitment.application_clarification_questions where application_id=? order by position",
            (r,n)->new Question(r.getObject("id",UUID.class),r.getString("criterion_key"),r.getString("requirement"),r.getString("evidence"),
                r.getString("match_level"),r.getBoolean("required"),r.getString("question"),r.getString("response_status"),r.getString("answer"),r.getLong("version"),instant(r,"answered_at")),id);
        // The question set refers to the original assessment, even if HR later re-runs scoring.
        Instant assessedAt=state==null?(assessment==null?null:assessment.createdAt()):jdbc.queryForObject("select a.created_at from recruitment.ai_assessments a join recruitment.application_clarification_sets s on s.assessment_id=a.id where s.application_id=?",Timestamp.class,id).toInstant();
        return new ApplicationClarificationDto(label,editable,canGenerate,retry,assessedAt,questions);
    }
    public ApplicationClarificationDto generate(Authentication auth,UUID id) {
        // Authorization precedes capacity checks. The network call holds no database transaction.
        authorize(auth,id,false,false);
        if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau.");
        try {
            Claim claim=new TransactionTemplate(transactions).execute(tx->claim(auth,id));
            if(claim==null) return get(auth,id,false);
            try {
                var generated=ai.clarificationQuestions(claim.input());
                var byKey=validate(generated,claim.targets());
                new TransactionTemplate(transactions).executeWithoutResult(tx->{
                    var app=authorize(auth,id,false,true);var current=state(id);
                    if(current==null || !claim.token().equals(current.token())) return;
                    if(CLOSED.contains(app.status())) {fail(id,claim.token());return;}
                    for(int i=0;i<claim.targets().size();i++) {
                        var t=claim.targets().get(i);
                        jdbc.update("""
                            insert into recruitment.application_clarification_questions(application_id,position,criterion_key,requirement,evidence,match_level,required,question)
                            values(?,?,?,?,?,?,?,?)
                            """,id,i,t.key(),t.requirement(),t.evidence(),t.matchLevel(),t.required(),byKey.get(t.key()));
                    }
                    jdbc.update("update recruitment.application_clarification_sets set state='READY',lease_token=null,lease_until=null,model_name=?,prompt_version=?,updated_at=now() where application_id=? and lease_token=?",
                        generated.modelName(),generated.promptVersion(),id,claim.token());
                });
            } catch(RuntimeException unavailable) {
                // Do not persist provider bodies or fabricate substitute questions.
                new TransactionTemplate(transactions).executeWithoutResult(tx->fail(id,claim.token()));
            }
            return get(auth,id,false);
        } finally {slots.release();}
    }
    private Claim claim(Authentication auth,UUID id) {
        var app=authorize(auth,id,false,true);
        if(CLOSED.contains(app.status())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Hồ sơ đã kết thúc; không thể bổ sung thông tin.");
        var state=state(id);
        if(state!=null && (Set.of("READY","NOT_NEEDED").contains(state.state()) || working(state))) return null;
        var assessment=latest(id);if(assessment==null) return null;
        Instant now=Instant.now(), retry=retryAt(state);
        if(retry!=null && retry.isAfter(now)) return null;
        var input=contexts.input(app.job(),app.resume());
        if(!input.inputHash().equals(assessment.inputHash())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Cần phân tích lại hồ sơ trước khi tạo câu hỏi bổ sung.");
        var allowed=AssessmentContext.targets(input.job());
        var targets=jdbc.query("select criterion_key,match_level,coalesce(evidence,'') as evidence from recruitment.ai_assessment_criteria where assessment_id=? and match_level in ('PARTIAL','NO_EVIDENCE')",
            (r,n)->new String[]{r.getString(1),r.getString(2),r.getString(3)},assessment.id()).stream()
            .filter(row->allowed.containsKey(row[0]) && allowed.get(row[0]).weight().signum()>0)
            .map(row->{var t=allowed.get(row[0]);return new Target(row[0],t.name(),t.required(),row[1],row[2],t.weight());})
            .sorted(Comparator.comparing(Target::required).reversed().thenComparing(Target::weight,Comparator.reverseOrder()).thenComparing(Target::key))
            .limit(3).toList();
        UUID token=targets.isEmpty()?null:UUID.randomUUID();
        boolean reset=state==null || !state.window().plusSeconds(3600).isAfter(now);
        jdbc.update("""
            insert into recruitment.application_clarification_sets(application_id,assessment_id,state,lease_token,lease_until,retry_at,attempts,window_started_at)
            values(?,?,?,?,?,?,?,?) on conflict(application_id) do update set assessment_id=excluded.assessment_id,state=excluded.state,
            lease_token=excluded.lease_token,lease_until=excluded.lease_until,retry_at=excluded.retry_at,attempts=excluded.attempts,window_started_at=excluded.window_started_at,updated_at=now()
            """,id,assessment.id(),targets.isEmpty()?"NOT_NEEDED":"GENERATING",token,token==null?null:Timestamp.from(now.plusSeconds(180)),Timestamp.from(now.plusSeconds(60)),
            reset?1:state.attempts()+1,Timestamp.from(reset?now:state.window()));
        if(targets.isEmpty()) return null;
        var selected=targets.stream().map(t->Map.of("criterion_key",t.key(),"requirement",t.requirement(),"match_level",t.matchLevel(),"evidence",t.evidence())).toList();
        return new Claim(token,targets,Map.of("job",input.job(),"resume",input.resume(),"targets",selected));
    }
    private void fail(UUID id,UUID token) {
        jdbc.update("update recruitment.application_clarification_sets set state='FAILED',lease_token=null,lease_until=null,updated_at=now() where application_id=? and lease_token=?",id,token);
    }
    static Map<String,String> validate(Generated generated,List<Target> targets) {
        if(generated==null || !"clarifications-v1".equals(generated.promptVersion()) || generated.modelName()==null || generated.modelName().isBlank() || generated.modelName().length()>100 || generated.questions()==null || generated.questions().size()!=targets.size())
            throw new IllegalArgumentException("Invalid generated questions");
        Set<String> expected=new HashSet<>();targets.forEach(t->expected.add(t.key()));
        Map<String,String> result=new HashMap<>();
        for(var q:generated.questions()) {
            if(q==null || !expected.contains(q.criterionKey()) || q.question()==null || q.question().isBlank() || q.question().length()>1200 || result.put(q.criterionKey(),q.question().strip())!=null)
                throw new IllegalArgumentException("Invalid generated question");
        }
        return result;
    }
    public ApplicationClarificationDto answer(Authentication auth,UUID id,UUID questionId,Answer input) {
        return new TransactionTemplate(transactions).execute(tx->{
            var app=authorize(auth,id,false,true);
            if(CLOSED.contains(app.status())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Hồ sơ đã kết thúc; không thể sửa câu trả lời.");
            String answer=input.answer()==null?"":input.answer().strip();boolean skip="SKIP".equals(input.action());
            if(!skip && answer.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Hãy nhập câu trả lời hoặc chọn Bỏ qua.");
            var rows=jdbc.query("select version from recruitment.application_clarification_questions where id=? and application_id=?",(r,n)->r.getLong(1),questionId,id);
            if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy câu hỏi.");
            if(!rows.getFirst().equals(input.version())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Câu trả lời đã thay đổi ở nơi khác. Hãy tải lại trước khi sửa.");
            jdbc.update("update recruitment.application_clarification_questions set answer=?,response_status=?,version=version+1,answered_at=now() where id=? and application_id=?",
                skip?"":answer,skip?"SKIPPED":"ANSWERED",questionId,id);
            return view(id,app,false);
        });
    }
}
