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
    private final CvDocumentService documents;
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

    @Transactional(readOnly = true)
    public InterviewScorecardDto get(Authentication auth, UUID applicationId) {
        requireStaff(auth);
        requireApplication(applicationId);
        return findByApplicationId(applicationId);
    }

    @Transactional
    public InterviewScorecardDto generate(Authentication auth, UUID applicationId, boolean force) {
        var user = requireStaff(auth);
        requireApplication(applicationId);

        if (!force) {
            var existing = findByApplicationId(applicationId);
            if (existing != null) {
                return existing;
            }
        }

        var snapshot = jdbc.query(
                "select a.job_snapshot::text, s.content::text, a.candidate_id::text, a.job_id::text, a.resume_id::text, a.submission_format, a.source_document_id::text from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id where a.id=?",
                (rs, n) -> new String[]{rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7)},
                applicationId
        ).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa có CV đã nộp."));

        var job = mapper.readTree(snapshot[0]);
        var resume = mapper.readTree(snapshot[1]);
        if ("ORIGINAL_PDF".equals(snapshot[5]) && !resume.path("pdfConfirmedAt").isMissingNode()) {
            resume = resume.path("pdfReviewedContent");
        } else if ("ORIGINAL_PDF".equals(snapshot[5]) && snapshot[6] != null) {
            var parsed = documents.parseForAssessment(UUID.fromString(snapshot[2]), UUID.fromString(snapshot[6]));
            resume = mapper.valueToTree(parsed);
        }

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
        payload.put("job_requirements", job.path("requirements").asText(""));
        payload.put("candidate_name", resume.path("fullName").asText("Ứng viên"));
        payload.put("cv_summary", resume.path("summary").asText(""));
        payload.put("cv_skills", cvSkills);
        payload.put("cv_projects", cvProjects);
        payload.put("assessment_missing_skills", assessmentMissingSkills);
        payload.put("github_unverified_skills", githubUnverified);
        payload.put("github_vibe_flags", githubVibeFlags);

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

        try {
            jdbc.update("""
                INSERT INTO recruitment.application_interview_scorecards (
                    application_id, interviewer_id, interviewer_name, status,
                    sections, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, 'DRAFT', ?::jsonb, ?, ?
                )
                ON CONFLICT (application_id) DO UPDATE SET
                    sections = EXCLUDED.sections,
                    updated_at = EXCLUDED.updated_at
                """,
                    applicationId,
                    user.getId(),
                    user.getFullName(),
                    mapper.writeValueAsString(sections),
                    Timestamp.from(Instant.now()),
                    Timestamp.from(Instant.now())
            );
        } catch (Exception e) {
            log.error("Failed to save generated interview scorecard for application {}", applicationId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu phiếu phỏng vấn.");
        }

        return findByApplicationId(applicationId);
    }

    @Transactional
    public InterviewScorecardDto save(Authentication auth, UUID applicationId, InterviewScorecardDto.SaveRequest request) {
        var user = requireStaff(auth);
        requireApplication(applicationId);

        if (request == null || request.sections() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dữ liệu phiếu phỏng vấn không hợp lệ.");
        }

        // Tính điểm trung bình từ các câu hỏi đã được chấm (1 - 5)
        int totalRated = 0;
        int totalScore = 0;
        for (var sec : request.sections()) {
            if (sec.questions() != null) {
                for (var q : sec.questions()) {
                    if (q.score() != null && q.score() >= 1 && q.score() <= 5) {
                        totalRated++;
                        totalScore += q.score();
                    }
                }
            }
        }

        BigDecimal overallScore = null;
        if (totalRated > 0) {
            overallScore = BigDecimal.valueOf((double) totalScore / totalRated).setScale(1, RoundingMode.HALF_UP);
        }

        String status = "COMPLETED".equalsIgnoreCase(request.status()) ? "COMPLETED" : "DRAFT";

        try {
            jdbc.update("""
                INSERT INTO recruitment.application_interview_scorecards (
                    application_id, interviewer_id, interviewer_name, status,
                    overall_score, recommendation, overall_notes, sections, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?
                )
                ON CONFLICT (application_id) DO UPDATE SET
                    interviewer_id = EXCLUDED.interviewer_id,
                    interviewer_name = EXCLUDED.interviewer_name,
                    status = EXCLUDED.status,
                    overall_score = EXCLUDED.overall_score,
                    recommendation = EXCLUDED.recommendation,
                    overall_notes = EXCLUDED.overall_notes,
                    sections = EXCLUDED.sections,
                    updated_at = EXCLUDED.updated_at
                """,
                    applicationId,
                    user.getId(),
                    user.getFullName(),
                    status,
                    overallScore,
                    request.recommendation(),
                    request.overallNotes(),
                    mapper.writeValueAsString(request.sections()),
                    Timestamp.from(Instant.now()),
                    Timestamp.from(Instant.now())
            );
        } catch (Exception e) {
            log.error("Failed to update interview scorecard for application {}", applicationId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể cập nhật phiếu phỏng vấn.");
        }

        return findByApplicationId(applicationId);
    }

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
                    rs.getTimestamp("updated_at").toInstant()
            );
        } catch (Exception e) {
            log.error("Error reading interview scorecard row", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi đọc dữ liệu phiếu phỏng vấn.");
        }
    }
}

