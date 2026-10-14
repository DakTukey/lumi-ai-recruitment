package com.lumi.recruitment.dto;

import java.util.List;

public record ParsedJobDraftDto(
    String title,
    String category,
    String headcount,
    String location,
    String level,
    String mode,
    String employmentType,
    String salaryMode,
    String salaryMin,
    String salaryMax,
    String deadline,
    String description,
    String requirements,
    String benefits,
    List<SkillItem> skills,
    List<CriterionItem> criteria,
    String suggestedDepartment,
    String departmentId
) {
    public record SkillItem(String name, boolean required) {}
    public record CriterionItem(String id, String type, String description, boolean required, double weight) {}
}
