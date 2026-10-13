package com.lumi.recruitment.entity.recruitment;
import com.lumi.recruitment.entity.auth.User;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;
import java.util.UUID;
import java.time.Instant;
import java.math.BigDecimal;
@Entity @Table(name="jobs", schema="recruitment")
@Getter @Setter @NoArgsConstructor
public class Job {
 @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
 @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="department_id") private Department department;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="position_id") private JobPosition position;
 @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="created_by") private User createdBy;
 @Column(nullable=false, length=255) private String title;
 @NotNull @Positive @Column(nullable=false) private Integer headcount = 1;
 @Column(nullable=false, columnDefinition="text") private String description;
 @Column(nullable=false, columnDefinition="text") private String requirements;
 @Column(nullable=false, columnDefinition="text") private String benefits;
 /** Raw legacy text retained for data preservation; use JobSkill for new data. */
 @Deprecated @Column(nullable=false, columnDefinition="text") private String skills = "";
 @Column(nullable=false, length=255) private String location;
 @Column(name="employment_type", nullable=false, length=20) private String employmentType;
 @Column(name="work_mode", nullable=false, length=20) private String workMode;
 @Column(name="experience_level", nullable=false, length=20) private String experienceLevel;
 @Column(name="salary_min", precision=15, scale=2) private BigDecimal salaryMin;
 @Column(name="salary_max", precision=15, scale=2) private BigDecimal salaryMax;
 @Column(nullable=false, length=3) private String currency;
 @Column(nullable=false, length=20) private String status;
 @Column(nullable=false) private boolean featured;
 @Column(name="published_at") private Instant publishedAt;
 @Column(name="application_deadline") private Instant applicationDeadline;
 @Column(name="created_at", nullable=false) private Instant createdAt;
 @Column(name="updated_at", nullable=false) private Instant updatedAt;
 @Version @Column(nullable=false) private long version;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="updated_by") private User updatedBy;
}
