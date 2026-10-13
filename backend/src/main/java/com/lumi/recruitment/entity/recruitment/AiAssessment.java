package com.lumi.recruitment.entity.recruitment;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_assessments", schema = "recruitment")
@Getter @Setter @NoArgsConstructor
public class AiAssessment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_id", nullable = false, updatable = false)
    private UUID applicationId;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "prompt_version", nullable = false, length = 20)
    private String promptVersion;

    @Column(nullable = false)
    private int score;

    @Column(nullable = false, columnDefinition = "text")
    private String summary;

    @Column(name = "matched_skills", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String matchedSkills = "[]";

    @Column(name = "missing_skills", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String missingSkills = "[]";

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String gaps = "[]";

    @Column(name = "interview_questions", nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String interviewQuestions = "[]";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name="job_context_hash", length=64, updatable=false)
    private String jobContextHash;
    @Column(name="input_hash", length=64, updatable=false)
    private String inputHash;
    @Column(name="evaluation_version", length=50, updatable=false)
    private String evaluationVersion;

    @PrePersist
    void onCreate() { createdAt = Instant.now(); }
}
