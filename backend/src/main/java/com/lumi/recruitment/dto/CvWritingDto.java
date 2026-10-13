package com.lumi.recruitment.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public final class CvWritingDto {
    private CvWritingDto() {}
    public record Request(
        @NotBlank @Pattern(regexp="summary|experience|project") String section,
        @NotBlank @Pattern(regexp="polish|shorten|bullets") String action,
        @NotBlank @Size(max=6000) String text,
        @Size(max=1000) String context
    ) {}
    public record Result(String suggestion, List<String> questions, String model_name, String prompt_version) {}
}
