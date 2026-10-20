package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.GithubVerificationDto;
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

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GithubVerificationService {
    private final JdbcTemplate jdbc;
    private final AiServiceClient ai;
    private final UserRepository users;
    private final CvDocumentService documents;
    private final ObjectMapper mapper;

    private void requireStaff(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.RECRUITER && user.getRole() != UserRole.COMPANY_ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ dành cho nhân sự tuyển dụng.");
    }

    private void requireApplication(UUID id) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where id=?)", Boolean.class, id)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn ứng tuyển.");
    }

    @Transactional(readOnly = true)
    public GithubVerificationDto get(Authentication auth, UUID applicationId) {
        requireStaff(auth);
        requireApplication(applicationId);
        return latest(applicationId);
    }

    @Transactional
    public GithubVerificationDto verify(Authentication auth, UUID applicationId, boolean force) {
        requireStaff(auth);
        requireApplication(applicationId);

        // Check if fresh cache exists within 24 hours
        if (!force) {
            var cached = latest(applicationId);
            if (cached != null && Duration.between(cached.fetchedAt(), Instant.now()).toHours() < 24) {
                return cached;
            }
        }

        var snapshot = jdbc.query(
                "select a.job_snapshot::text, s.content::text, a.candidate_id::text, a.job_id::text, a.resume_id::text, a.submission_format, a.source_document_id::text from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id where a.id=?",
                (rs, n) -> new String[]{rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7)},
                applicationId
        ).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa có CV đã nộp."));

        var resume = mapper.readTree(snapshot[1]);
        if ("ORIGINAL_PDF".equals(snapshot[5]) && !resume.path("pdfConfirmedAt").isMissingNode()) {
            resume = resume.path("pdfReviewedContent");
        } else if ("ORIGINAL_PDF".equals(snapshot[5]) && snapshot[6] != null) {
            var parsed = documents.parseForAssessment(UUID.fromString(snapshot[2]), UUID.fromString(snapshot[6]));
            resume = mapper.valueToTree(parsed);
        }

        String githubUrl = null;
        if (resume.hasNonNull("githubUrl") && !resume.get("githubUrl").asText().isBlank()) {
            githubUrl = resume.get("githubUrl").asText().trim();
        } else if (resume.hasNonNull("github_url") && !resume.get("github_url").asText().isBlank()) {
            githubUrl = resume.get("github_url").asText().trim();
        }

        if (githubUrl == null || githubUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hồ sơ ứng viên không có liên kết GitHub.");
        }

        List<String> cvSkills = new ArrayList<>();
        if (resume.has("skills") && resume.get("skills").isArray()) {
            for (var node : resume.get("skills")) {
                if (node.isTextual() && !node.asText().isBlank()) {
                    cvSkills.add(node.asText().trim());
                }
            }
        }

        List<Object> cvProjects = new ArrayList<>();
        if (resume.has("projects") && resume.get("projects").isArray()) {
            for (var node : resume.get("projects")) {
                try {
                    cvProjects.add(mapper.treeToValue(node, Object.class));
                } catch (Exception ignored) {}
            }
        }

        var wire = ai.verifyGithub(githubUrl, cvSkills, cvProjects);

        var matchedProjects = wire.matchedProjects() != null ? wire.matchedProjects().stream()
                .map(m -> new GithubVerificationDto.MatchedProjectDto(m.cvProject(), m.githubRepo(), m.confidence()))
                .toList() : List.<GithubVerificationDto.MatchedProjectDto>of();

        try {
            jdbc.update("""
                INSERT INTO recruitment.application_github_verifications (
                    application_id, github_username, verified_skills, unverified_skills,
                    matched_projects, code_quality_score, technical_summary,
                    interview_suggestions, vibe_coding_flags, has_tests, has_docker,
                    has_ci, top_languages, model_name, fetched_at
                ) VALUES (
                    ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?, ?
                )
                ON CONFLICT (application_id) DO UPDATE SET
                    github_username = EXCLUDED.github_username,
                    verified_skills = EXCLUDED.verified_skills,
                    unverified_skills = EXCLUDED.unverified_skills,
                    matched_projects = EXCLUDED.matched_projects,
                    code_quality_score = EXCLUDED.code_quality_score,
                    technical_summary = EXCLUDED.technical_summary,
                    interview_suggestions = EXCLUDED.interview_suggestions,
                    vibe_coding_flags = EXCLUDED.vibe_coding_flags,
                    has_tests = EXCLUDED.has_tests,
                    has_docker = EXCLUDED.has_docker,
                    has_ci = EXCLUDED.has_ci,
                    top_languages = EXCLUDED.top_languages,
                    model_name = EXCLUDED.model_name,
                    fetched_at = EXCLUDED.fetched_at
                """,
                    applicationId,
                    wire.githubUsername(),
                    mapper.writeValueAsString(wire.verifiedSkills() != null ? wire.verifiedSkills() : List.of()),
                    mapper.writeValueAsString(wire.unverifiedSkills() != null ? wire.unverifiedSkills() : List.of()),
                    mapper.writeValueAsString(matchedProjects),
                    wire.codeQualityScore(),
                    wire.technicalSummary(),
                    mapper.writeValueAsString(wire.interviewSuggestions() != null ? wire.interviewSuggestions() : List.of()),
                    mapper.writeValueAsString(wire.vibeCodingFlags() != null ? wire.vibeCodingFlags() : List.of()),
                    wire.hasTests(),
                    wire.hasDocker(),
                    wire.hasCi(),
                    mapper.writeValueAsString(wire.topLanguages() != null ? wire.topLanguages() : Map.of()),
                    wire.modelName(),
                    Timestamp.from(Instant.now())
            );
        } catch (Exception e) {
            log.error("Failed to save github verification for application {}", applicationId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu kết quả kiểm tra GitHub.");
        }

        return latest(applicationId);
    }

    private GithubVerificationDto latest(UUID applicationId) {
        return jdbc.query(
                "SELECT * FROM recruitment.application_github_verifications WHERE application_id = ?",
                (rs, n) -> mapRow(rs),
                applicationId
        ).stream().findFirst().orElse(null);
    }

    private GithubVerificationDto mapRow(ResultSet rs) throws SQLException {
        try {
            var verifiedSkillsArr = mapper.readValue(rs.getString("verified_skills"), GithubVerificationDto.VerifiedSkillDto[].class);
            var unverifiedSkillsArr = mapper.readValue(rs.getString("unverified_skills"), GithubVerificationDto.UnverifiedSkillDto[].class);
            var matchedProjectsArr = mapper.readValue(rs.getString("matched_projects"), GithubVerificationDto.MatchedProjectDto[].class);
            var interviewSuggestionsArr = mapper.readValue(rs.getString("interview_suggestions"), String[].class);
            var vibeCodingFlagsArr = mapper.readValue(rs.getString("vibe_coding_flags"), String[].class);
            @SuppressWarnings("unchecked")
            Map<String, Double> topLanguages = mapper.readValue(rs.getString("top_languages"), Map.class);

            return new GithubVerificationDto(
                    rs.getObject("application_id", UUID.class),
                    rs.getString("github_username"),
                    verifiedSkillsArr != null ? List.of(verifiedSkillsArr) : List.of(),
                    unverifiedSkillsArr != null ? List.of(unverifiedSkillsArr) : List.of(),
                    matchedProjectsArr != null ? List.of(matchedProjectsArr) : List.of(),
                    rs.getInt("code_quality_score"),
                    rs.getString("technical_summary"),
                    interviewSuggestionsArr != null ? List.of(interviewSuggestionsArr) : List.of(),
                    vibeCodingFlagsArr != null ? List.of(vibeCodingFlagsArr) : List.of(),
                    rs.getBoolean("has_tests"),
                    rs.getBoolean("has_docker"),
                    rs.getBoolean("has_ci"),
                    topLanguages != null ? topLanguages : Map.of(),
                    rs.getString("model_name"),
                    rs.getTimestamp("fetched_at").toInstant()
            );
        } catch (Exception e) {
            log.error("Error reading github verification row", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi đọc dữ liệu kiểm tra GitHub.");
        }
    }
}

