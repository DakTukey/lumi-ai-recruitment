package com.lumi.recruitment.entity.recruitment;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity @Table(name="job_positions", schema="recruitment")
@Getter @Setter @NoArgsConstructor
public class JobPosition {
    @Id @GeneratedValue(strategy=GenerationType.UUID) private UUID id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false) @JoinColumn(name="department_id") private Department department;
    @Column(nullable=false, length=150) private String name;
    @Column(name="is_active", nullable=false) private boolean active = true;
}
