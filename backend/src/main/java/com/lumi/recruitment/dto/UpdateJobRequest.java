package com.lumi.recruitment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record UpdateJobRequest(@NotNull @PositiveOrZero Long version,
        @NotNull @Valid CreateJobRequest content) {}
