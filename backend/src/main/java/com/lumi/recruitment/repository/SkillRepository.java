package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.catalog.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface SkillRepository extends JpaRepository<Skill, UUID> {
    Optional<Skill> findByNormalizedName(String normalizedName);
}
