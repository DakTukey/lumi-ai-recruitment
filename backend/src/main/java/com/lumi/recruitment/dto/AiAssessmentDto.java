package com.lumi.recruitment.dto;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiAssessmentDto(
        UUID id,
        UUID applicationId,
        String modelName,
        String promptVersion,
        int score,
        String summary,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<CriterionDto> criteria,
        List<GapDto> gaps,
        List<InterviewQuestionDto> interviewQuestions,
        Instant createdAt
) {
    public record CriterionDto(
            String skill,
            String matchLevel,   // MATCHED | PARTIAL | NO_EVIDENCE
            String evidence,
            String reason,
            int points,
            BigDecimal weight
    ) {}

    public record GapDto(
            String skill,
            String currentLevel,
            String targetLevel,
            String roadmap
    ) {}

    public record InterviewQuestionDto(
            String question,
            String reason,
            String targetSkill
    ) {}
}
