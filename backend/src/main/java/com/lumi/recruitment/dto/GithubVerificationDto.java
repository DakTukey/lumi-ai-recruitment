package com.lumi.recruitment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record GithubVerificationDto(
        UUID applicationId,
        String githubUsername,
        List<VerifiedSkillDto> verifiedSkills,
        List<UnverifiedSkillDto> unverifiedSkills,
        List<MatchedProjectDto> matchedProjects,
        int codeQualityScore,
        String technicalSummary,
        List<String> interviewSuggestions,
        List<String> vibeCodingFlags,
        boolean hasTests,
        boolean hasDocker,
        boolean hasCi,
        Map<String, Double> topLanguages,
        String modelName,
        Instant fetchedAt
) {
    public record VerifiedSkillDto(
            String skill,
            String evidence
    ) {}

    public record UnverifiedSkillDto(
            String skill,
            String note
    ) {}

    public record MatchedProjectDto(
            String cvProject,
            String githubRepo,
            String confidence
    ) {}

    public record Request(
            Boolean force
    ) {}

    public record WireResult(
            @JsonProperty("github_username") String githubUsername,
            @JsonProperty("verified_skills") List<VerifiedSkillDto> verifiedSkills,
            @JsonProperty("unverified_skills") List<UnverifiedSkillDto> unverifiedSkills,
            @JsonProperty("matched_projects") List<MatchedProjectWire> matchedProjects,
            @JsonProperty("code_quality_score") int codeQualityScore,
            @JsonProperty("technical_summary") String technicalSummary,
            @JsonProperty("interview_suggestions") List<String> interviewSuggestions,
            @JsonProperty("vibe_coding_flags") List<String> vibeCodingFlags,
            @JsonProperty("has_tests") boolean hasTests,
            @JsonProperty("has_docker") boolean hasDocker,
            @JsonProperty("has_ci") boolean hasCi,
            @JsonProperty("top_languages") Map<String, Double> topLanguages,
            @JsonProperty("model_name") String modelName
    ) {}

    public record MatchedProjectWire(
            @JsonProperty("cv_project") String cvProject,
            @JsonProperty("github_repo") String githubRepo,
            @JsonProperty("confidence") String confidence
    ) {}
}

