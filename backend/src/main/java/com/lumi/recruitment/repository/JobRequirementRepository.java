package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.JobRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface JobRequirementRepository extends JpaRepository<JobRequirement, UUID> {
    List<JobRequirement> findByJobIdOrderBySortOrderAscIdAsc(UUID jobId);
}
