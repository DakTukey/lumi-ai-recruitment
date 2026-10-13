package com.lumi.recruitment.repository;
import com.lumi.recruitment.entity.recruitment.RecruiterProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface RecruiterProfileRepository extends JpaRepository<RecruiterProfile, UUID> {}
