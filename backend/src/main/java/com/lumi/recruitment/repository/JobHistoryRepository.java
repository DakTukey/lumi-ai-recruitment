package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.JobHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;
import java.util.UUID;
public interface JobHistoryRepository extends JpaRepository<JobHistory, UUID> {
    Page<JobHistory> findByJobIdOrderByCreatedAtDescIdAsc(UUID jobId, Pageable pageable);
}
