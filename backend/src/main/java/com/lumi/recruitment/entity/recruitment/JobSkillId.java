package com.lumi.recruitment.entity.recruitment;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.util.UUID;

@Embeddable @Data @NoArgsConstructor @AllArgsConstructor
public class JobSkillId implements Serializable {
    @Column(name = "job_id") private UUID jobId;
    @Column(name = "skill_id") private UUID skillId;
}
