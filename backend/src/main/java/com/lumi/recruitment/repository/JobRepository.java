package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.Job;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
public interface JobRepository extends JpaRepository<Job,UUID>, JpaSpecificationExecutor<Job> {
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @Query("select j from Job j where j.id = :id")
 java.util.Optional<Job> findForApplication(@org.springframework.data.repository.query.Param("id") UUID id);
}
