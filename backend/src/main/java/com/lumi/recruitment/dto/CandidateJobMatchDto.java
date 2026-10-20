package com.lumi.recruitment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CandidateJobMatchDto(
    String source,
    String jobId,
    String resumeId,
    String resumeTitle,
    long resumeVersion,
    Integer score,
    String summary,
    List<CriterionDto> criteria,
    List<GapDto> gaps,
    Instant evaluatedAt,
    long jobVersion,
    String modelName,
    String promptVersion,
    String sourceDocumentId,
    Long documentVersion
) {
    public record CriterionDto(
        String id,
        String name,
        boolean required,
        BigDecimal weight,
        Integer score,
        String status,
        String source,
        String evidence,
        String reason,
        String suggestion,
        String jobEvidence
    ) {}

    public record GapDto(
        String skill,
        String currentLevel,
        String targetLevel,
        String roadmap
    ) {}

    public record MatchRequest(
        @jakarta.validation.constraints.NotNull UUID resumeId,
        Boolean force
    ) {
        public MatchRequest { force = Boolean.TRUE.equals(force); }
    }
    public record PdfMatchRequest(
        @jakarta.validation.constraints.NotNull UUID documentId,
        @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.PositiveOrZero Long documentVersion,
        Boolean force
    ) {
        public PdfMatchRequest { force = Boolean.TRUE.equals(force); }
    }
}
