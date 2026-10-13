package com.lumi.recruitment.dto;

import com.lumi.recruitment.entity.candidate.ResumeSections.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

/** Unsaved CV content only. Contact information and identity are deliberately excluded. */
public final class CvReviewDto {
    private CvReviewDto() {}
    public record Context(
        @Size(max=255) String desiredPosition, @Size(max=6000) String summary,
        @NotNull @Size(max=100) List<@NotBlank @Size(max=100) String> skills,
        @NotNull @Size(max=30) List<@NotNull @Valid Experience> experiences,
        @NotNull @Size(max=30) List<@NotNull @Valid Education> educations,
        @NotNull @Size(max=30) List<@NotNull @Valid Project> projects,
        @NotNull @Size(max=30) List<@NotNull @Valid Certification> certifications,
        @NotNull @Size(max=30) List<@NotNull @Valid Language> languages,
        @NotNull @Size(max=30) List<@NotNull @Valid Award> awards,
        @NotNull @Size(max=30) List<@NotNull @Valid Activity> activities) {}
    public record Request(@NotNull @Valid Context resume, UUID jobId) {}
    public record Target(@NotNull @Pattern(regexp="summary|experience|project") String section,
                         @Min(-1) @Max(29) int index) {}
    public record RefineRequest(@NotNull @Valid Context resume, UUID jobId,
                               @NotNull @Valid Target target, @NotBlank @Size(max=3000) String answer) {}
    public record JobContext(String title, String description, String requirements, List<String> skills, String experienceLevel) {}
    public record Item(String section, int index, String kind, String reason, String evidence,
                       String job_evidence, String question, String suggestion) {}
    public record Result(String overview, List<Item> items, String model_name, String prompt_version) {}
    public record Refined(String suggestion, List<String> questions, String model_name, String prompt_version) {}
}
