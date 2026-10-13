package com.lumi.recruitment.entity.recruitment;

import com.lumi.recruitment.entity.catalog.Skill;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "job_skills", schema = "recruitment")
@Getter @Setter @NoArgsConstructor
public class JobSkill {
    @EmbeddedId private JobSkillId id = new JobSkillId();
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @MapsId("jobId")
    @JoinColumn(name = "job_id", nullable = false) private Job job;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @MapsId("skillId")
    @JoinColumn(name = "skill_id", nullable = false) private Skill skill;
    @Column(name = "is_required", nullable = false) private boolean required = true;
}
