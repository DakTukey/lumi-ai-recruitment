package com.lumi.recruitment.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
public record SubmitApplicationRequest(@NotNull UUID jobId, UUID resumeId,
 @PositiveOrZero Long resumeVersion, @Size(max=10000) String coverLetter, @Pattern(regexp="BUILDER|ORIGINAL_PDF") String submissionFormat,
 UUID sourceDocumentId, @PositiveOrZero Long documentVersion) {}
