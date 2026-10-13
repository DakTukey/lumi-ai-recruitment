package com.lumi.recruitment.entity.recruitment;

import com.lumi.recruitment.entity.auth.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "recruiter_profiles", schema = "recruitment")
@Getter @Setter @NoArgsConstructor
public class RecruiterProfile {
    @Id @Column(name = "user_id") private UUID userId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId
    @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "employee_code", length = 50) private String employeeCode;
    @Column(length = 30) private String phone;
    @Column(name = "job_title", length = 255) private String jobTitle;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "department_id") private Department department;
    @Column(name = "avatar_url", length = 2048) private String avatarUrl;
    @Version @Column(nullable = false) private long version;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @PrePersist void create() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void update() { updatedAt = Instant.now(); }
}
