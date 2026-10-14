package com.lumi.recruitment.entity.candidate;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name="resumes", schema="candidate")
@Getter @Setter @NoArgsConstructor
public class Resume {
    @Id @GeneratedValue(strategy=GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="candidate_id", nullable=false)
    private CandidateProfile candidate;
    @Column(nullable=false, length=100) private String title;
    @Column(name="full_name", length=150) private String fullName;
    @Column(length=255) private String email;
    @Column(length=30) private String phone;
    @Column(length=255) private String location;
    @Column(name="desired_position", length=255) private String desiredPosition;
    @Column(columnDefinition="text") private String summary;
    @Column(name="github_url", length=2048) private String githubUrl;
    @Column(name="linkedin_url", length=2048) private String linkedinUrl;
    @Column(name="portfolio_url", length=2048) private String portfolioUrl;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<String> skills = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Experience> experiences = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Education> educations = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Project> projects = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Certification> certifications = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Language> languages = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Award> awards = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.Activity> activities = new ArrayList<>();
    @Column(name="source_document_id") private UUID sourceDocumentId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="extra_sections", columnDefinition="jsonb", nullable=false)
    private List<ResumeSections.ExtraSection> extraSections = new ArrayList<>();
    @Column(nullable=false, length=20) private String template;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private ResumeStatus status;
    @Column(name="is_default", nullable=false) private boolean defaultResume;
    @Version @Column(nullable=false) private long version;
    @Column(name="created_at", nullable=false, updatable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
}
