package com.lumi.recruitment.repository;

import com.lumi.recruitment.entity.candidate.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface ResumeRepository extends JpaRepository<Resume, UUID> {
    List<Resume> findByCandidate_UserIdOrderByUpdatedAtDesc(UUID candidateId);
    Optional<Resume> findByIdAndCandidate_UserId(UUID id, UUID candidateId);
    Optional<Resume> findByCandidate_UserIdAndDefaultResumeTrue(UUID candidateId);
}
