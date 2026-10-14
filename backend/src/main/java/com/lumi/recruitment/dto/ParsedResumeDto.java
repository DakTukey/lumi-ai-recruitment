package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.candidate.ResumeSections.*;
import java.util.List;

public record ParsedResumeDto(
    String title,
    String fullName,
    String email,
    String phone,
    String location,
    String desiredPosition,
    String summary,
    String githubUrl,
    String linkedinUrl,
    String portfolioUrl,
    List<String> skills,
    List<Experience> experiences,
    List<Education> educations,
    List<Project> projects,
    List<Certification> certifications,
    List<Language> languages,
    List<Award> awards,
    List<Activity> activities,
    List<ExtraSection> extraSections, List<String> warnings, String extractedText, Integer pageCount
) {}
