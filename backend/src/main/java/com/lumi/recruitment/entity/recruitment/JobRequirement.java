package com.lumi.recruitment.entity.recruitment;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity @Table(name = "job_requirements", schema = "recruitment")
@Getter @Setter @NoArgsConstructor
public class JobRequirement {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false) private Job job;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private RequirementType type;
    @Column(nullable = false, columnDefinition = "text") private String description;
    @Column(name = "is_required", nullable = false) private boolean required = true;
    @Column(nullable = false, precision = 5, scale = 2) private BigDecimal weight = BigDecimal.ONE;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
}
