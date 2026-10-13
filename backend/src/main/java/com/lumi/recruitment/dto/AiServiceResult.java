package com.lumi.recruitment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Wire contract with the internal AI service, validated before any database write. */
public record AiServiceResult(
    @JsonProperty("application_id") UUID applicationId,
    @JsonProperty("model_name") String modelName,
    @JsonProperty("prompt_version") String promptVersion,
    Integer score, String summary,
    @JsonProperty("matched_skills") List<String> matchedSkills,
    @JsonProperty("missing_skills") List<String> missingSkills,
    List<Criterion> criteria, List<Gap> gaps,
    @JsonProperty("interview_questions") List<Question> interviewQuestions) {
    public record Criterion(@JsonProperty("criterion_key") String key, String skill,
        @JsonProperty("match_level") String matchLevel, String evidence, String reason,
        Integer points, BigDecimal weight) {}
    public record Gap(String skill, @JsonProperty("current_level") String currentLevel,
        @JsonProperty("target_level") String targetLevel, String roadmap) {}
    public record Question(String question, String reason,
        @JsonProperty("target_skill") String targetSkill) {}
}
