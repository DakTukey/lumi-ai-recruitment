package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.InterviewScorecardDto;
import com.lumi.recruitment.entity.auth.User;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewScorecardService {
    private final JdbcTemplate jdbc;
    private final AiServiceClient ai;
    private final UserRepository users;
    private final SubmittedCvSource sources;
    private final PlatformTransactionManager transactions;
    private final Set<UUID> generating=ConcurrentHashMap.newKeySet();
    private final Semaphore slots=new Semaphore(2);
    private final ObjectMapper mapper;

    private User requireStaff(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.RECRUITER && user.getRole() != UserRole.COMPANY_ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ dành cho nhân sự tuyển dụng.");
        return user;
    }

    private void requireApplication(UUID id) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where id=?)", Boolean.class, id)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn ứng tuyển.");
    }

    private void requireInterviewStage(UUID id, boolean lock) {
        var stage=jdbc.query("select status from recruitment.applications where id=?"+(lock?" for update":""),
            (row,n)->row.getString(1),id).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn ứng tuyển."));
        if(!"INTERVIEW".equals(stage)) throw conflict(
            "Chỉ được tạo hoặc cập nhật phiếu khi hồ sơ đang ở vòng Phỏng vấn. Phiếu đã lưu vẫn được xem lại. Hãy cập nhật trạng thái hồ sơ.");
    }

    @Transactional(readOnly = true)
    public InterviewScorecardDto get(Authentication auth, UUID applicationId) {
        requireStaff(auth);
        requireApplication(applicationId);
        return findByApplicationId(applicationId);
    }

    public InterviewScorecardDto generate(Authentication auth, UUID applicationId, boolean force) {
        var user=requireStaff(auth);requireInterviewStage(applicationId,false);
        var existing=findByApplicationId(applicationId);
        if(existing!=null && !force) return existing;
        if(existing!=null && !regenerable(existing)) throw conflict("Phiếu đã có điểm, ghi chú hoặc đã hoàn tất. Bộ câu hỏi được giữ để bảo toàn biên bản.");
        if(!generating.add(applicationId)) throw conflict("Phiếu đang được tạo. Hãy chờ kết quả.");
        if(!slots.tryAcquire()) {generating.remove(applicationId);throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau.");}
        try {
        var source=sources.ready(applicationId);
        var job=source.job();var resume=source.resume();
        // Lấy missing_skills từ AI assessment gần nhất
        List<String> assessmentMissingSkills = jdbc.query(
                "SELECT missing_skills FROM recruitment.ai_assessments WHERE application_id = ? ORDER BY created_at DESC LIMIT 1",
                (rs, n) -> {
                    try {
                        String[] arr = mapper.readValue(rs.getString(1), String[].class);
                        return arr != null ? List.of(arr) : List.<String>of();
                    } catch (Exception e) {
                        return List.<String>of();
                    }
                },
                applicationId
        ).stream().findFirst().orElse(List.of());

        // Lấy github unverified_skills và vibe_flags nếu có
        List<String> githubUnverified = new ArrayList<>();
        List<String> githubVibeFlags = new ArrayList<>();
        jdbc.query(
                "SELECT unverified_skills, vibe_coding_flags FROM recruitment.application_github_verifications WHERE application_id = ?",
                (rs, n) -> {
                    try {
                        var uvNode = mapper.readTree(rs.getString(1));
                        if (uvNode.isArray()) {
                            for (var item : uvNode) {
                                if (item.hasNonNull("skill")) githubUnverified.add(item.get("skill").asText());
                            }
                        }
                        String[] vibeArr = mapper.readValue(rs.getString(2), String[].class);
                        if (vibeArr != null) githubVibeFlags.addAll(List.of(vibeArr));
                    } catch (Exception ignored) {}
                    return null;
                },
                applicationId
        );

        List<String> cvSkills = new ArrayList<>();
        if (resume.has("skills") && resume.get("skills").isArray()) {
            for (var node : resume.get("skills")) {
                if (node.isTextual() && !node.asText().isBlank()) cvSkills.add(node.asText().trim());
            }
        }

        List<Object> cvProjects = new ArrayList<>();
        if (resume.has("projects") && resume.get("projects").isArray()) {
            for (var node : resume.get("projects")) {
                try { cvProjects.add(mapper.treeToValue(node, Object.class)); } catch (Exception ignored) {}
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("job_title", job.path("title").asText(""));
        payload.put("job_requirements", clipped(job.path("requirements").asText(""),10000));
        payload.put("candidate_name", "Ứng viên");
        payload.put("cv_summary", clipped(resume.path("summary").asText(""),5000));
        payload.put("cv_skills", cvSkills.stream().limit(50).toList());
        payload.put("cv_projects", cvProjects.stream().limit(10).toList());
        payload.put("assessment_missing_skills", assessmentMissingSkills.stream().limit(20).toList());
        payload.put("github_unverified_skills", githubUnverified.stream().limit(20).toList());
        payload.put("github_vibe_flags", githubVibeFlags.stream().limit(10).toList());

        var clarificationAnswers=jdbc.query("""
            select requirement,question,evidence,response_status,answer from recruitment.application_clarification_questions
            where application_id=? order by position limit 3
            """,(r,n)->Map.of("requirement",r.getString(1),"question",r.getString(2),"evidence",clipped(r.getString(3),2000),
                "response_status",r.getString(4),"answer",r.getString(5)),applicationId);
        payload.put("clarifications",clarificationAnswers);
        var wire = ai.generateInterviewScorecard(payload);

        List<InterviewScorecardDto.SectionDto> sections = new ArrayList<>();
        if (wire.sections() != null) {
            for (var s : wire.sections()) {
                List<InterviewScorecardDto.QuestionDto> questions = new ArrayList<>();
                if (s.questions() != null) {
                    for (var q : s.questions()) {
                        questions.add(new InterviewScorecardDto.QuestionDto(
                                q.id(), q.question(), q.targetSkill(), q.context(),
                                q.rubricGood(), q.rubricPoor(), null, ""
                        ));
                    }
                }
                sections.add(new InterviewScorecardDto.SectionDto(s.title(), questions));
            }
        }

        validateQuestions(sections);
        return new TransactionTemplate(transactions).execute(tx->{
            // The HR stage may change while the provider is generating questions.
            // Hold the same application row lock as a stage update before persisting.
            requireInterviewStage(applicationId,true);
            var current=findByApplicationId(applicationId);
            if(existing==null?current!=null:current==null || current.version()!=existing.version())
                throw conflict("Phiếu đã thay đổi trong khi AI xử lý. Hãy tải bản mới nhất.");
            if(current!=null && !regenerable(current)) throw conflict("Phiếu đã có nội dung phỏng vấn; không thể tạo lại.");
            jdbc.update("""
                insert into recruitment.application_interview_scorecards(application_id,interviewer_id,interviewer_name,status,sections,version)
                values(?,?,?,'DRAFT',?::jsonb,0)
                on conflict(application_id) do update set interviewer_id=excluded.interviewer_id,interviewer_name=excluded.interviewer_name,
                status='DRAFT',sections=excluded.sections,overall_score=null,recommendation=null,overall_notes=null,
                version=application_interview_scorecards.version+1,updated_at=now()
                """,applicationId,user.getId(),user.getFullName(),mapper.writeValueAsString(sections));
            return findByApplicationId(applicationId);
        });
        } finally {slots.release();generating.remove(applicationId);}
    }

    @Transactional
    public InterviewScorecardDto save(Authentication auth, UUID applicationId, InterviewScorecardDto.SaveRequest request) {
        var user=requireStaff(auth);requireInterviewStage(applicationId,true);
        var current=findByApplicationId(applicationId);
        if(current==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Hãy tạo phiếu phỏng vấn trước khi lưu.");
        if(request==null || request.version()==null || request.version()!=current.version()) throw conflict("Phiếu đã thay đổi. Hãy tải bản mới nhất trước khi sửa.");
        if("COMPLETED".equals(current.status())) throw conflict("Phiếu đã hoàn tất và được giữ nguyên biên bản.");
        if(!Set.of("DRAFT","COMPLETED").contains(request.status()==null?"":request.status())) throw bad("Trạng thái phiếu không hợp lệ.");
        if(request.recommendation()!=null && !Set.of("STRONG_HIRE","HIRE","CONSIDER","NO_HIRE").contains(request.recommendation())) throw bad("Đề xuất tuyển dụng không hợp lệ.");
        if(request.sections()==null || request.sections().size()!=current.sections().size()) throw bad("Bộ câu hỏi đã thay đổi; hãy tải lại.");
        var merged=new ArrayList<InterviewScorecardDto.SectionDto>();int sum=0,rated=0,total=0;
        for(int i=0;i<current.sections().size();i++) {
            var saved=current.sections().get(i);var input=request.sections().get(i);
            if(input==null || input.questions()==null || !saved.title().equals(input.title()) || input.questions().size()!=saved.questions().size()) throw bad("Nhóm câu hỏi không hợp lệ.");
            var questions=new ArrayList<InterviewScorecardDto.QuestionDto>();
            for(int j=0;j<saved.questions().size();j++) {
                var q=saved.questions().get(j);var answer=input.questions().get(j);total++;
                if(answer==null || !q.id().equals(answer.id()) || !q.question().equals(answer.question()) || !q.targetSkill().equals(answer.targetSkill()) || !q.context().equals(answer.context()) || !q.rubricGood().equals(answer.rubricGood()) || !q.rubricPoor().equals(answer.rubricPoor())) throw bad("Chỉ được sửa điểm và ghi chú, không thay đổi câu hỏi AI đã lưu.");
                if(answer.score()!=null) {if(answer.score()<1 || answer.score()>5) throw bad("Điểm mỗi câu phải từ 1 đến 5.");rated++;sum+=answer.score();}
                questions.add(new InterviewScorecardDto.QuestionDto(q.id(),q.question(),q.targetSkill(),q.context(),q.rubricGood(),q.rubricPoor(),answer.score(),notes(answer.notes(),2000)));
            }
            merged.add(new InterviewScorecardDto.SectionDto(saved.title(),questions));
        }
        if("COMPLETED".equals(request.status()) && (rated!=total || total==0 || request.recommendation()==null)) throw bad("Hãy chấm đủ các câu hỏi và chọn đề xuất trước khi hoàn tất.");
        BigDecimal average=rated==0?null:BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(rated),1,RoundingMode.HALF_UP);
        jdbc.update("""
            update recruitment.application_interview_scorecards set interviewer_id=?,interviewer_name=?,status=?,overall_score=?,recommendation=?,
            overall_notes=?,sections=?::jsonb,version=version+1,updated_at=now() where application_id=? and version=?
            """,user.getId(),user.getFullName(),request.status(),average,request.recommendation(),notes(request.overallNotes(),4000),mapper.writeValueAsString(merged),applicationId,current.version());
        return findByApplicationId(applicationId);
    }
    private static ResponseStatusException conflict(String message) {return new ResponseStatusException(HttpStatus.CONFLICT,message);}
    private static ResponseStatusException bad(String message) {return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    private static String clipped(String text,int max) {return text==null?"":text.substring(0,Math.min(text.length(),max));}
    private static String notes(String text,int max) {if(text!=null && text.length()>max) throw bad("Ghi chú vượt giới hạn "+max+" ký tự.");return text==null?"":text.strip();}
    private static boolean regenerable(InterviewScorecardDto card) {
        return !"COMPLETED".equals(card.status()) && card.overallScore()==null && card.recommendation()==null && (card.overallNotes()==null || card.overallNotes().isBlank())
            && card.sections().stream().flatMap(s->s.questions().stream()).noneMatch(q->q.score()!=null || q.notes()!=null && !q.notes().isBlank());
    }
    private static void validateQuestions(List<InterviewScorecardDto.SectionDto> sections) {
        Set<String> ids=new HashSet<>();int count=0;
        if(sections.size()<2 || sections.size()>3) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AI chưa trả về đủ nhóm câu hỏi hợp lệ.");
        for(var section:sections) {
            if(!text(section.title(),200) || section.questions()==null || section.questions().size()<2 || section.questions().size()>3) throw invalidQuestions();
            for(var q:section.questions()) {
                count++;
                if(!text(q.id(),50) || !ids.add(q.id()) || !text(q.question(),500) || !text(q.targetSkill(),200) || !text(q.context(),500) || !text(q.rubricGood(),500) || !text(q.rubricPoor(),500)) throw invalidQuestions();
            }
        }
        if(count<6 || count>8) throw invalidQuestions();
    }
    private static boolean text(String text,int max) {return text!=null && !text.isBlank() && text.length()<=max;}
    private static ResponseStatusException invalidQuestions() {return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AI chưa trả về đủ câu hỏi hợp lệ. Chưa lưu phiếu; hãy thử lại sau.");}

    private InterviewScorecardDto findByApplicationId(UUID applicationId) {
        return jdbc.query(
                "SELECT * FROM recruitment.application_interview_scorecards WHERE application_id = ?",
                (rs, n) -> mapRow(rs),
                applicationId
        ).stream().findFirst().orElse(null);
    }

    private InterviewScorecardDto mapRow(ResultSet rs) throws SQLException {
        try {
            var sectionsArr = mapper.readValue(rs.getString("sections"), InterviewScorecardDto.SectionDto[].class);
            return new InterviewScorecardDto(
                    rs.getObject("application_id", UUID.class),
                    rs.getObject("interviewer_id", UUID.class),
                    rs.getString("interviewer_name"),
                    rs.getString("status"),
                    rs.getBigDecimal("overall_score"),
                    rs.getString("recommendation"),
                    rs.getString("overall_notes"),
                    sectionsArr != null ? List.of(sectionsArr) : List.of(),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("updated_at").toInstant(),
                    rs.getLong("version")
            );
        } catch (Exception e) {
            log.error("Error reading interview scorecard row", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi đọc dữ liệu phiếu phỏng vấn.");
        }
    }
}

