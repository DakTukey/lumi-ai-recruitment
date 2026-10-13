package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.recruitment.RequirementType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** Only editable content; lifecycle and author are always assigned by the server. */
public record CreateJobRequest(
        @NotNull UUID departmentId,
        @NotNull UUID positionId,
        @NotBlank @Size(max=255) String title,
        @NotNull @DecimalMin("1") @DecimalMax("2147483647") @Digits(integer=10, fraction=0) BigDecimal headcount,
        @NotBlank @Size(max=20000) String description,
        @NotBlank @Size(max=20000) String requirements,
        @NotNull @Size(max=20000) String benefits,
        @NotBlank @Size(max=255) String location,
        @NotNull EmploymentType employmentType,
        @NotNull WorkMode workMode,
        @NotNull ExperienceLevel experienceLevel,
        @DecimalMin("0") @Digits(integer=13, fraction=2) BigDecimal salaryMin,
        @DecimalMin("0") @Digits(integer=13, fraction=2) BigDecimal salaryMax,
        LocalDate applicationDeadline,
        @NotNull @Size(min=1, max=100) List<@NotNull @Valid SkillInput> skills,
        @NotNull @Size(max=100) List<@NotNull @Valid CriterionInput> criteria) {
    public enum EmploymentType { FULL_TIME, PART_TIME, INTERNSHIP, CONTRACT }
    public enum WorkMode { ONSITE, HYBRID, REMOTE }
    public enum ExperienceLevel { INTERN, JUNIOR, MIDDLE, SENIOR }
    public record SkillInput(@NotBlank @Size(max=100) String name, @NotNull Boolean required) {}
    public record CriterionInput(@NotNull RequirementType type,
            @NotBlank @Size(max=20000) String description, @NotNull Boolean required,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3, fraction=2) BigDecimal weight) {}
}
