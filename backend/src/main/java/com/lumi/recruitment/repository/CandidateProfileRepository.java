package com.lumi.recruitment.repository;

import com.lumi.recruitment.entity.candidate.CandidateProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface CandidateProfileRepository extends JpaRepository<CandidateProfile, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from CandidateProfile p where p.userId = :id")
    java.util.Optional<CandidateProfile> findForResumeWrite(@org.springframework.data.repository.query.Param("id") UUID id);
}
