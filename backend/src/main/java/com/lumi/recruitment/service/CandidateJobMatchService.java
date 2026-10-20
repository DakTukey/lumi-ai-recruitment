package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;

@Service @RequiredArgsConstructor
public class CandidateJobMatchService {
    static final String CACHE_VERSION = "candidate-match-v5";
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final AiServiceClient aiClient;
    private final ObjectMapper mapper;
    private final AssessmentContext contexts;
    private final CvBuilderPolicy builderPolicy;
    private final Semaphore slots = new Semaphore(2);
    private record Input(String hash, JsonNode job, JsonNode resume, String title, long resumeVersion, long jobVersion) {}

    private UUID owner(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.CANDIDATE) throw new AccessDeniedException("Chỉ dành cho tài khoản ứng viên.");
        return user.getId();
    }

    // One SQL statement provides consistent CV/JD snapshots. No contact/identity fields leave this service.
    private Input input(UUID candidate, UUID jobId, UUID resumeId, boolean pdf) {
        String cv = pdf ? """
            select display_name title,review_version version,
              case when status='PARSED' and confirmed_at is not null and reviewed_content is not null then 'READY' else status end status,
              reviewed_content content from candidate.resume_documents where id=? and candidate_id=?
            """ : """
            select title,version,status,jsonb_build_object('desiredPosition',desired_position,'summary',summary,
              'skills',skills,'experiences',experiences,'educations',educations,'projects',projects,
              'certifications',certifications,'languages',languages,'awards',awards,'activities',activities,
              'extraSections',extra_sections,'githubUrl',github_url,'portfolioUrl',portfolio_url) content
            from candidate.resumes where id=? and candidate_id=?
            """;
        String json = jdbc.query("with cv as ("+cv+") " + """
            select jsonb_build_object('title',r.title,'resumeVersion',r.version,'status',r.status,
              'jobVersion',j.version,
              'job',jsonb_build_object('title',j.title,'description',j.description,'requirements',j.requirements,
                'benefits',j.benefits,'location',j.location,'employmentType',j.employment_type,
                'workMode',j.work_mode,'experienceLevel',j.experience_level,
                'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'required',js.is_required) order by s.id)
                  from recruitment.job_skills js join catalog.skills s on s.id=js.skill_id where js.job_id=j.id),'[]'::jsonb),
                'criteria',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'type',q.type,'description',q.description,
                  'required',q.is_required,'weight',q.weight) order by q.sort_order,q.id)
                  from recruitment.job_requirements q where q.job_id=j.id),'[]'::jsonb)),
              'resume',r.content)::text
            from recruitment.jobs j join recruitment.departments d on d.id=j.department_id
            cross join cv r
            where j.id=? and j.status='PUBLISHED'
              and j.published_at<=statement_timestamp() and d.is_active
              and (j.application_deadline is null or j.application_deadline>statement_timestamp())
            """, (rs,n)->rs.getString(1), resumeId, candidate, jobId).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy CV của bạn hoặc tin đang tuyển."));
        var data=mapper.readTree(json);
        if (!"READY".equals(data.path("status").asText()))
            throw new ResponseStatusException(pdf?HttpStatus.CONFLICT:HttpStatus.BAD_REQUEST,"Hãy đọc PDF và xác nhận thông tin trước khi đối chiếu.");
        ((tools.jackson.databind.node.ObjectNode)data).set("resume",contexts.resume(data.path("resume")));
        json=mapper.writeValueAsString(data);
        if (json.length()>120000) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT,"CV hoặc JD quá dài để đối chiếu. Hãy rút gọn nội dung.");
        if (data.at("/job/skills").isEmpty() && data.at("/job/criteria").isEmpty())
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT,"Tin chưa có kỹ năng hoặc tiêu chí để đối chiếu.");
        try {
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((CACHE_VERSION+"\n"+json).getBytes(StandardCharsets.UTF_8)));
            return new Input(hash,data.path("job"),data.path("resume"),data.path("title").asText(),
                data.path("resumeVersion").asLong(),data.path("jobVersion").asLong());
        } catch(java.security.NoSuchAlgorithmException e) {throw new IllegalStateException(e);}
    }

    @Transactional(readOnly=true)
    public CandidateJobMatchDto getCachedMatch(Authentication auth, UUID jobId, UUID resumeId) {
        UUID candidate=owner(auth);return cached(candidate,jobId,resumeId,input(candidate,jobId,resumeId,false),false);
    }
    @Transactional(readOnly=true)
    public CandidateJobMatchDto getCachedPdfMatch(Authentication auth,UUID jobId,UUID documentId) {
        UUID candidate=owner(auth);return cached(candidate,jobId,documentId,input(candidate,jobId,documentId,true),true);
    }
    private static String table(boolean pdf) {return pdf?"recruitment.candidate_pdf_job_matches":"recruitment.candidate_job_matches";}
    private CandidateJobMatchDto cached(UUID candidate,UUID jobId,UUID resumeId,Input input,boolean pdf) {
        return jdbc.query("""
            select score,summary,criteria::text,gaps::text,updated_at,model_name
            from %s
            where candidate_id=? and job_id=? and %s=? and source_hash=? and prompt_version=?
            """.formatted(table(pdf),pdf?"document_id":"resume_id"),(rs,n)->new CandidateJobMatchDto("assessment",jobId.toString(),pdf?null:resumeId.toString(),input.title(),input.resumeVersion(),
                rs.getInt(1),rs.getString(2),List.of(mapper.readValue(rs.getString(3),CandidateJobMatchDto.CriterionDto[].class)),
                List.of(mapper.readValue(rs.getString(4),CandidateJobMatchDto.GapDto[].class)),rs.getTimestamp(5).toInstant(),
                input.jobVersion(),rs.getString(6),CACHE_VERSION,pdf?resumeId.toString():null,pdf?input.resumeVersion():null),candidate,jobId,resumeId,input.hash(),CACHE_VERSION)
            .stream().findFirst().orElse(null);
    }

    @Transactional
    public CandidateJobMatchDto match(Authentication auth, UUID jobId, UUID resumeId, boolean force) {
        builderPolicy.requireEnabled();
        return matchSource(auth,jobId,resumeId,force,false,null);
    }
    @Transactional
    public CandidateJobMatchDto matchPdf(Authentication auth,UUID jobId,UUID documentId,long version,boolean force) {
        return matchSource(auth,jobId,documentId,force,true,version);
    }
    private CandidateJobMatchDto matchSource(Authentication auth,UUID jobId,UUID resumeId,boolean force,boolean pdf,Long version) {
        UUID candidate=owner(auth);Input input=input(candidate,jobId,resumeId,pdf);
        if(version!=null && version!=input.resumeVersion())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Thông tin PDF vừa thay đổi. Hãy tải lại bản đã xác nhận.");
        var existing=cached(candidate,jobId,resumeId,input,pdf);
        if (!force && existing!=null) return existing;
        if (force && existing!=null && existing.evaluatedAt().isAfter(Instant.now().minusSeconds(30)))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Kết quả vừa được tạo. Hãy chờ 30 giây trước khi phân tích lại.");
        if (!Boolean.TRUE.equals(jdbc.queryForObject("select pg_try_advisory_xact_lock(hashtextextended(?,0))",Boolean.class,"candidate-match:"+candidate)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Bạn đang có một yêu cầu đối chiếu. Hãy chờ kết quả trước khi thử lại.");
        if (!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau ít giây.");
        var context=contexts.input(input.job(),input.resume());
        String requestId=UUID.randomUUID().toString();AiServiceResult result;
        try {result=aiClient.assess(requestId,context.job().toString(),context.resume().toString());}
        finally {slots.release();}
        var targets=AssessmentContext.targets(context.job());
        AssessmentContext.validate(UUID.fromString(requestId),context,result);
        // Re-read SQL, avoiding JPA's first-level cache when CV/JD changes during the request.
        if (!input.hash().equals(input(candidate,jobId,resumeId,pdf).hash()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"CV hoặc tin tuyển dụng vừa thay đổi. Hãy tải lại dữ liệu và đối chiếu lại.");
        var gaps=result.gaps().stream().map(g->new CandidateJobMatchDto.GapDto(g.skill(),g.currentLevel(),g.skill(),g.roadmap())).toList();
        var criteria=result.criteria().stream().map(c->{
            var meta=targets.get(c.key());
            String suggestion=gaps.stream().filter(g->g.skill().equals(c.skill())).map(CandidateJobMatchDto.GapDto::roadmap).findFirst()
                .orElse("MATCHED".equals(c.matchLevel())?"Chuẩn bị ví dụ thực tế cho vòng phỏng vấn.":"Nếu đã có trải nghiệm, bổ sung vai trò, cách thực hiện và kết quả vào CV.");
            return new CandidateJobMatchDto.CriterionDto(c.key(),meta.name(),meta.required(),meta.weight(),
                "NO_EVIDENCE".equals(c.matchLevel())?null:c.points(),c.matchLevel(),source(input.resume(),c.evidence()),
                c.evidence(),c.reason(),suggestion,meta.name());
        }).toList();
        Instant now=Instant.now();
        String idColumn=pdf?"document_id":"resume_id", versionColumn=pdf?"document_version":"resume_version";
        jdbc.update("""
            insert into %s
              (candidate_id,job_id,%s,job_version,%s,score,summary,criteria,gaps,source_hash,prompt_version,model_name,job_context_hash,input_hash,evaluation_version,assessment_payload,created_at,updated_at)
            values (?,?,?,?,?,?,?,?::jsonb,?::jsonb,?,?,?,?,?,?,?::jsonb,?,?)
            on conflict(candidate_id,job_id,%s) do update set
              job_version=excluded.job_version,%s=excluded.%s,score=excluded.score,summary=excluded.summary,
              criteria=excluded.criteria,gaps=excluded.gaps,source_hash=excluded.source_hash,prompt_version=excluded.prompt_version,
              model_name=excluded.model_name,job_context_hash=excluded.job_context_hash,input_hash=excluded.input_hash,evaluation_version=excluded.evaluation_version,assessment_payload=excluded.assessment_payload,updated_at=excluded.updated_at
            """.formatted(table(pdf),idColumn,versionColumn,idColumn,versionColumn,versionColumn),candidate,jobId,resumeId,input.jobVersion(),input.resumeVersion(),result.score(),result.summary(),
            mapper.writeValueAsString(criteria),mapper.writeValueAsString(gaps),input.hash(),CACHE_VERSION,result.modelName(),context.jobHash(),context.inputHash(),AssessmentContext.EVALUATION_VERSION,mapper.writeValueAsString(result),
            java.sql.Timestamp.from(now),java.sql.Timestamp.from(now));
        return new CandidateJobMatchDto("assessment",jobId.toString(),pdf?null:resumeId.toString(),input.title(),input.resumeVersion(),
            result.score(),result.summary(),criteria,gaps,now,input.jobVersion(),result.modelName(),CACHE_VERSION,pdf?resumeId.toString():null,pdf?input.resumeVersion():null);
    }

    private static boolean contains(JsonNode node,String quote) {
        if(node.isString()) return node.asText().contains(quote);
        if(node.isContainer()) for(var child:node) if(contains(child,quote)) return true;
        return false;
    }
    private static String source(JsonNode resume,String quote) {
        if(quote==null || quote.isBlank()) return "CV · Chưa có trích dẫn";
        for(String section:List.of("experiences","projects","skills","educations","certifications","languages","awards","activities","extraSections","summary","desiredPosition"))
            if(contains(resume.path(section),quote)) return switch(section) {
                case "experiences" -> "CV · Kinh nghiệm";case "projects" -> "CV · Dự án";case "skills" -> "CV · Kỹ năng tự khai";
                case "educations" -> "CV · Học vấn";case "certifications" -> "CV · Chứng chỉ tự khai";case "languages" -> "CV · Ngoại ngữ";
                case "awards" -> "CV · Giải thưởng";case "activities" -> "CV · Hoạt động";case "extraSections" -> "CV · Mục bổ sung";default -> "CV · Giới thiệu";
            };
        return "CV · Liên kết tự khai";
    }
}
