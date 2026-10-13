package com.lumi.recruitment.dto;

import jakarta.validation.constraints.*;

public record JobActionRequest(@NotNull @PositiveOrZero Long version) {}
