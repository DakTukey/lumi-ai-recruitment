package com.lumi.recruitment.entity.candidate;

import com.lumi.recruitment.entity.auth.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "candidate_profiles", schema = "candidate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateProfile {

    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 255)
    private String headline;

    @Column(length = 30)
    private String phone;

    /** Danh sách kỹ năng lưu dạng chuỗi phân cách bởi dấu phẩy, ví dụ: "React,TypeScript,Git" */
    @Column(columnDefinition = "TEXT")
    private String skills;

    @Column(name = "experience_years", precision = 4, scale = 1)
    private BigDecimal experienceYears;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name="employment_types", columnDefinition="jsonb", nullable=false)
    @Builder.Default
    private java.util.List<String> employmentTypes = new java.util.ArrayList<>();

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name="work_modes", columnDefinition="jsonb", nullable=false)
    @Builder.Default
    private java.util.List<String> workModes = new java.util.ArrayList<>();

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name="preferred_locations", columnDefinition="jsonb", nullable=false)
    @Builder.Default
    private java.util.List<String> preferredLocations = new java.util.ArrayList<>();

    @Column(name="experience_range", length=30)
    private String experienceRange;

    @Column(name="position_undecided", nullable=false)
    private boolean positionUndecided;

    @Column(length = 255)
    private String location;

    @Column(name = "desired_position", length = 255)
    private String desiredPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "onboarding_status", nullable = false, length = 20)
    @Builder.Default
    private OnboardingStatus onboardingStatus = OnboardingStatus.NOT_STARTED;

    @Column(name = "onboarding_step", nullable = false)
    @Builder.Default
    private int onboardingStep = 0;

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
