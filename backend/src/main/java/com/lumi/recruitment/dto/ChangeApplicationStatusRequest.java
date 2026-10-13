package com.lumi.recruitment.dto;
import jakarta.validation.constraints.*;
public record ChangeApplicationStatusRequest(@NotNull @PositiveOrZero Long version,
 @NotBlank @Pattern(regexp="REVIEWING|INTERVIEW|OFFER|HIRED|REJECTED") String status,
 @Size(max=2000) String reason) {}
