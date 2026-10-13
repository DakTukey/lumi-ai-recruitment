package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor
public class AiAssessmentService {
    private final JdbcTemplate jdbc;
    private final ApplicationAiEvaluator evaluator;
    private final UserRepository users;
    private final ObjectMapper mapper;
    public static final String PROMPT_VERSION = AssessmentContext.PROMPT_VERSION;

    private void requireStaff(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.RECRUITER && user.getRole() != UserRole.COMPANY_ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho nhân sự tuyển dụng.");
    }
    private void requireApplication(UUID id) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where id=?)",Boolean.class,id)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn ứng tuyển.");
    }
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public AiAssessmentDto getLatest(Authentication auth, UUID id) {
        requireStaff(auth); requireApplication(id); return latest(id);
    }
    private AiAssessmentDto latest(UUID id) {
        return jdbc.query("select * from recruitment.ai_assessments where application_id=? order by created_at desc,id desc limit 1",
            (r,n)->mapRow(r),id).stream().findFirst().orElse(null);
    }
    @Transactional
    public AiAssessmentDto analyze(Authentication auth, UUID id, boolean force) {
        requireStaff(auth); requireApplication(id);
        evaluator.evaluate(id,force);
        return latest(id);
    }
    /**
     * Lấy Top N ứng viên điểm AI cao nhất cho một job.
     * Chỉ tính đơn chưa bị loại/rút; mỗi đơn chỉ lấy assessment gần nhất.
     */
    @Transactional(readOnly = true)
    public List<TopCandidateDto> getTopCandidates(Authentication auth, UUID jobId, int limit) {
        requireStaff(auth);
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM recruitment.jobs WHERE id = ?)",
                Boolean.class, jobId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin tuyển dụng.");

        int safeLimit = Math.max(1, Math.min(limit, 20));
        return jdbc.query("""
            SELECT a.id AS application_id,
                   u.full_name AS candidate_name,
                   u.email AS candidate_email,
                   rs.content->>'title' AS resume_title,
                   a.status AS application_status,
                   ai.score, ai.summary,
                   ai.matched_skills::text,
                   ai.missing_skills::text,
                   ai.created_at AS assessed_at
            FROM recruitment.applications a
            JOIN auth.users u ON u.id = a.candidate_id
            LEFT JOIN recruitment.application_resume_snapshots rs ON rs.application_id = a.id
            JOIN LATERAL (
                SELECT score, summary, matched_skills, missing_skills, created_at
                FROM recruitment.ai_assessments
                WHERE application_id = a.id
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            ) ai ON true
            WHERE a.job_id = ?
              AND a.status NOT IN ('WITHDRAWN', 'REJECTED')
            ORDER BY ai.score DESC
            LIMIT ?
            """,
            (rs, n) -> {
                try {
                    var matched = mapper.readValue(rs.getString("matched_skills"), String[].class);
                    var missing = mapper.readValue(rs.getString("missing_skills"), String[].class);
                    return new TopCandidateDto(
                            rs.getObject("application_id", UUID.class),
                            rs.getString("candidate_name"),
                            rs.getString("candidate_email"),
                            rs.getString("resume_title"),
                            rs.getInt("score"),
                            rs.getString("summary"),
                            List.of(matched),
                            List.of(missing),
                            rs.getString("application_status"),
                            rs.getTimestamp("assessed_at").toInstant());
                } catch (Exception e) {
                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi đọc dữ liệu.");
                }
            },
            jobId, safeLimit);
    }

    private AiAssessmentDto mapRow(ResultSet r) throws SQLException {
        var criteria=jdbc.query("select skill,match_level,evidence,reason,points,weight from recruitment.ai_assessment_criteria where assessment_id=? order by criterion_key nulls last,id",
            (c,n)->new AiAssessmentDto.CriterionDto(c.getString(1),c.getString(2),c.getString(3),c.getString(4),c.getInt(5),c.getBigDecimal(6)),r.getObject("id",UUID.class));
        var matched=mapper.readValue(r.getString("matched_skills"),String[].class);
        var missing=mapper.readValue(r.getString("missing_skills"),String[].class);
        // Stored JSON uses the provider's snake_case contract; DTOs expose camelCase.
        var gaps=mapper.readValue(r.getString("gaps"),AiServiceResult.Gap[].class);
        var questions=mapper.readValue(r.getString("interview_questions"),AiServiceResult.Question[].class);
        return new AiAssessmentDto(r.getObject("id",UUID.class),r.getObject("application_id",UUID.class),r.getString("model_name"),r.getString("prompt_version"),r.getInt("score"),r.getString("summary"),
            List.of(matched),List.of(missing),criteria,
            Arrays.stream(gaps).map(g->new AiAssessmentDto.GapDto(g.skill(),g.currentLevel(),g.targetLevel(),g.roadmap())).toList(),
            Arrays.stream(questions).map(q->new AiAssessmentDto.InterviewQuestionDto(q.question(),q.reason(),q.targetSkill())).toList(),r.getTimestamp("created_at").toInstant());
    }
}
