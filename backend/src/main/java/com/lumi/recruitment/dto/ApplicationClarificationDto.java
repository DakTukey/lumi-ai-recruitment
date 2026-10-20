package com.lumi.recruitment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ApplicationClarificationDto(String state, boolean canEdit, boolean canGenerate,
        Instant retryAt, Instant assessedAt, List<Question> questions) {
    public record Question(UUID id, String criterionKey, String requirement, String evidence,
        String matchLevel, boolean required, String question, String responseStatus,
        String answer, long version, Instant answeredAt) {}
    public record Answer(@NotNull @Min(0) Long version,
        @NotNull @Pattern(regexp="ANSWER|SKIP") String action, @Size(max=3000) String answer) {}
    public record GeneratedQuestion(@JsonProperty("criterion_key") String criterionKey, String question) {}
    public record Generated(List<GeneratedQuestion> questions,
        @JsonProperty("model_name") String modelName, @JsonProperty("prompt_version") String promptVersion) {}
}
