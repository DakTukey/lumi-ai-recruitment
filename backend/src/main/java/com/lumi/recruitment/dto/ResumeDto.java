package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.candidate.ResumeSections.*;
import com.lumi.recruitment.entity.candidate.ResumeStatus;
import java.time.Instant;
import java.util.*;

public record ResumeDto(UUID id, UUID candidateId, String title, String fullName, String email,
        String phone, String location, String desiredPosition, String summary, String githubUrl,
        String linkedinUrl, String portfolioUrl, List<String> skills, List<Experience> experiences,
        List<Education> educations, List<Project> projects, List<Certification> certifications,
        List<Language> languages, List<Award> awards, List<Activity> activities,
        String template, ResumeStatus status, boolean isDefault, long version,
        Instant createdAt, Instant updatedAt, UUID sourceDocumentId, List<ExtraSection> extraSections) {}
