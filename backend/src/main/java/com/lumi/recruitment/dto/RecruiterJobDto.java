package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.recruitment.RequirementType;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public record RecruiterJobDto(UUID id, UUID departmentId, String departmentName,
        UUID positionId, String positionName,
        String title, int headcount, String description, String requirements, String benefits,
        String location, String employmentType, String workMode, String experienceLevel,
        BigDecimal salaryMin, BigDecimal salaryMax, String currency, String status,
        Instant publishedAt, Instant applicationDeadline, Instant createdAt, Instant updatedAt,
        long version, List<SkillDto> skills, List<CriterionDto> criteria, List<HistoryDto> history) {
    public record SkillDto(UUID id, String name, boolean required) {}
    public record CriterionDto(UUID id, RequirementType type, String description,
            boolean required, BigDecimal weight, int sortOrder) {}
    public record HistoryDto(UUID id, String action, String actor, String note, Instant at) {}
    public record PageDto(List<RecruiterJobDto> content, int page, int size, long totalElements,
            int totalPages, boolean first, boolean last) {}
}
