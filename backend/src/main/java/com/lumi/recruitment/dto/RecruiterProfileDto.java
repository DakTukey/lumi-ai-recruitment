package com.lumi.recruitment.dto;

import java.time.Instant;
import java.util.UUID;

public record RecruiterProfileDto(UUID userId, String fullName, String email, String role,
        String phone, String employeeCode, String jobTitle, UUID departmentId,
        String departmentName, boolean departmentActive, String avatarUrl,
        long version, Instant createdAt, Instant updatedAt) {}
