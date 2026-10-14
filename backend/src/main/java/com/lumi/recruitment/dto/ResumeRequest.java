package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.candidate.ResumeSections.*;
import com.lumi.recruitment.entity.candidate.ResumeStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import static com.lumi.recruitment.entity.candidate.ResumeSections.WEB_URL;

/** Full CV snapshot. Owner/default/timestamps come only from the server. */
public record ResumeRequest(
        @NotBlank @Size(max=100) String title,
        @Size(max=150) String fullName, @Email @Size(max=255) String email,
        @Size(max=30) @Pattern(regexp="[0-9+().\\s-]*") String phone,
        @Size(max=255) String location, @Size(max=255) String desiredPosition,
        @Size(max=6000) String summary,
        @Size(max=2048) @Pattern(regexp=WEB_URL) String githubUrl,
        @Size(max=2048) @Pattern(regexp=WEB_URL) String linkedinUrl,
        @Size(max=2048) @Pattern(regexp=WEB_URL) String portfolioUrl,
        @NotNull @Size(max=100) List<@NotBlank @Size(max=100) String> skills,
        @NotNull @Size(max=30) List<@NotNull @Valid Experience> experiences,
        @NotNull @Size(max=30) List<@NotNull @Valid Education> educations,
        @NotNull @Size(max=30) List<@NotNull @Valid Project> projects,
        @NotNull @Size(max=30) List<@NotNull @Valid Certification> certifications,
        @Size(max=30) List<@NotNull @Valid Language> languages,
        @Size(max=30) List<@NotNull @Valid Award> awards,
        @Size(max=30) List<@NotNull @Valid Activity> activities,
        @NotNull @Pattern(regexp="classic|modern") String template,
        @NotNull ResumeStatus status, @PositiveOrZero Long version,
        java.util.UUID sourceDocumentId,
        @Size(max=30) List<@NotNull @Valid ExtraSection> extraSections) {}
