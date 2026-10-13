package com.lumi.recruitment.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
public record AddApplicationNoteRequest(@NotBlank @Size(max=4000) String body,
 @NotNull UUID requestId) {}
