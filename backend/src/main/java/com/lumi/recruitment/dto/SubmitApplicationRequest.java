package com.lumi.recruitment.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
public record SubmitApplicationRequest(@NotNull UUID jobId, @NotNull UUID resumeId,
 @NotNull @PositiveOrZero Long resumeVersion, @Size(max=10000) String coverLetter) {}
