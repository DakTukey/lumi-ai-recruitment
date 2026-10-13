package com.lumi.recruitment.entity.recruitment;

import com.lumi.recruitment.entity.auth.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "job_history", schema = "recruitment")
@org.hibernate.annotations.Immutable
@Getter @Setter @NoArgsConstructor
public class JobHistory {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false) private Job job;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by", nullable = false) private User changedBy;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private JobHistoryAction action;
    @Column(name = "from_status", length = 20) private String fromStatus;
    @Column(name = "to_status", nullable = false, length = 20) private String toStatus;
    @Column(columnDefinition = "text") private String note;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> changes = new LinkedHashMap<>();
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @PrePersist void create() { createdAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS); }
}
