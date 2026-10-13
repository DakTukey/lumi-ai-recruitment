package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.candidate.OnboardingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CandidateProfileDto(UUID userId, String fullName, String email, String phone,
        String location, String desiredPosition, String skills, BigDecimal experienceYears,
        OnboardingStatus onboardingStatus, int onboardingStep, Instant updatedAt,
        java.util.List<String> employmentTypes, java.util.List<String> workModes,
        java.util.List<String> preferredLocations, String experienceRange, boolean positionUndecided) {}
