package com.lumi.recruitment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record InterviewScorecardDto(
        UUID applicationId,
        UUID interviewerId,
        String interviewerName,
        String status, // DRAFT, COMPLETED
        BigDecimal overallScore,
        String recommendation, // STRONG_HIRE, HIRE, CONSIDER, NO_HIRE
        String overallNotes,
        List<SectionDto> sections,
        Instant createdAt,
        Instant updatedAt
) {
    public record SectionDto(
            String title,
            List<QuestionDto> questions
    ) {}

    public record QuestionDto(
            String id,
            String question,
            @JsonProperty("target_skill") String targetSkill,
            String context,
            @JsonProperty("rubric_good") String rubricGood,
            @JsonProperty("rubric_poor") String rubricPoor,
            Integer score, // 1 - 5
            String notes
    ) {}

    public record SaveRequest(
            String status,
            String recommendation,
            String overallNotes,
            List<SectionDto> sections
    ) {}

    public record AiGenerateWireResult(
            List<SectionWire> sections,
            @JsonProperty("model_name") String modelName
    ) {
        public record SectionWire(
                String title,
                List<QuestionWire> questions
        ) {}

        public record QuestionWire(
                String id,
                String question,
                @JsonProperty("target_skill") String targetSkill,
                String context,
                @JsonProperty("rubric_good") String rubricGood,
                @JsonProperty("rubric_poor") String rubricPoor
        ) {}
    }
}

