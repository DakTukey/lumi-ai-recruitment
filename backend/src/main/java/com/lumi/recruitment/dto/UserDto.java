package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UserDto {
    private UUID id;
    private String email;
    private String fullName;
    private UserRole role;
    private UserStatus status;
    private Instant createdAt;
    private com.lumi.recruitment.entity.candidate.OnboardingStatus onboardingStatus;
}
