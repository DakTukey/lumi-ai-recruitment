package com.lumi.recruitment.repository;

import com.lumi.recruitment.entity.recruitment.JobPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface JobPositionRepository extends JpaRepository<JobPosition, UUID> {
    List<JobPosition> findByDepartmentIdAndActiveTrueOrderByNameAsc(UUID departmentId);
}
