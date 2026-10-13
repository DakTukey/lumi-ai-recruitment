package com.lumi.recruitment.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** Full editable profile snapshot. Identity, email, role and onboarding status are server owned. */
public record CandidateProfileRequest(
        @NotBlank(message = "Vui lòng nhập họ tên.") @Size(max = 150) String fullName,
        @Size(max = 30) @Pattern(regexp = "[0-9+().\\s-]*", message = "Số điện thoại chỉ gồm chữ số, khoảng trắng và + ( ) . -") String phone,
        @Size(max = 255) String location,
        @Size(max = 255) String desiredPosition,
        @Size(max = 4000) String skills,
        @DecimalMin("0.0") @DecimalMax("80.0") @Digits(integer = 2, fraction = 1) BigDecimal experienceYears,
        @Size(max=4) java.util.List<@NotNull @Pattern(regexp="FULL_TIME|PART_TIME|INTERNSHIP|CONTRACT") String> employmentTypes,
        @Size(max=3) java.util.List<@NotNull @Pattern(regexp="ONSITE|HYBRID|REMOTE") String> workModes,
        @Size(max=10) java.util.List<@NotBlank @Size(max=255) String> preferredLocations,
        @Pattern(regexp="NONE|UNDER_ONE|ONE_TO_THREE|THREE_TO_FIVE|FIVE_PLUS") String experienceRange,
        Boolean positionUndecided) {}
