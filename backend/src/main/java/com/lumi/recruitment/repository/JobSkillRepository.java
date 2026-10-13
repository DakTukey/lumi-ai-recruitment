package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface JobSkillRepository extends JpaRepository<JobSkill, JobSkillId> {
    @Query("select js from JobSkill js join fetch js.skill where js.job.id in :jobIds order by js.skill.normalizedName, js.skill.id")
    List<JobSkill> findForJobs(@Param("jobIds") Collection<UUID> jobIds);
}
