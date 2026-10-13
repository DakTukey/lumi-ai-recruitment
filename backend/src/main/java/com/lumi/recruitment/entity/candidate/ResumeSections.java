package com.lumi.recruitment.entity.candidate;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

/** Fixed shapes for the repeatable JSONB sections of a CV. Dates use YYYY-MM. */
public final class ResumeSections {
    private ResumeSections() {}
    public static final String MONTH = "(?:[0-9]{4}-(?:0[1-9]|1[0-2]))?";
    public static final String WEB_URL = "(?:https?://[^\\s]+)?";

    public record Experience(@Size(max=255) String company, @Size(max=255) String position,
            @Pattern(regexp=MONTH) String startDate, @Pattern(regexp=MONTH) String endDate,
            boolean current, @Size(max=6000) String description) {
        @AssertTrue(message="Thời gian kinh nghiệm không hợp lệ.")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isDateRangeValid() { return dates(startDate, endDate, current); }
    }
    public record Education(@Size(max=255) String school, @Size(max=255) String degree,
            @Size(max=255) String field, @Pattern(regexp=MONTH) String startDate,
            @Pattern(regexp=MONTH) String endDate, @Size(max=6000) String description,
            @DecimalMin("0") @Digits(integer=3, fraction=2) BigDecimal gpa, Integer gpaScale) {
        @AssertTrue(message="Thời gian học vấn không hợp lệ.")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isDateRangeValid() { return dates(startDate, endDate, false); }
        @AssertTrue(message="GPA cần có thang điểm 4, 10 hoặc 100 và không vượt quá thang điểm.")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isGpaValid() {
            if (gpa == null) return gpaScale == null;
            return gpaScale != null && List.of(4, 10, 100).contains(gpaScale)
                && gpa.compareTo(BigDecimal.valueOf(gpaScale)) <= 0;
        }
    }
    public record Project(@Size(max=255) String name, @Size(max=255) String role,
            @Size(max=2048) @Pattern(regexp=WEB_URL) String url, @Size(max=6000) String description,
            @Pattern(regexp=MONTH) String startDate, @Pattern(regexp=MONTH) String endDate,
            Boolean current, @Size(max=100) List<@NotBlank @Size(max=100) String> technologies) {
        public Project { current = Boolean.TRUE.equals(current); }
        @AssertTrue(message="Thời gian dự án không hợp lệ.")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isDateRangeValid() { return dates(startDate, endDate, current); }
    }
    public record Certification(@Size(max=255) String name, @Size(max=255) String issuer,
            @Pattern(regexp=MONTH) String issuedDate,
            @Size(max=2048) @Pattern(regexp=WEB_URL) String credentialUrl) {}

    public record Language(@Size(max=255) String name, @Size(max=255) String proficiency,
            @Size(max=255) String certification) {}
    public record Award(@Size(max=255) String title, @Size(max=255) String issuer,
            @Pattern(regexp=MONTH) String awardedDate, @Size(max=6000) String description) {}
    public record Activity(@Size(max=255) String name, @Size(max=255) String organization,
            @Size(max=255) String role, @Pattern(regexp=MONTH) String startDate,
            @Pattern(regexp=MONTH) String endDate, boolean current,
            @Size(max=6000) String description) {
        @AssertTrue(message="Thời gian hoạt động không hợp lệ.")
        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isDateRangeValid() { return dates(startDate, endDate, current); }
    }

    private static boolean dates(String start, String end, boolean current) {
        if (current && end != null && !end.isBlank()) return false;
        return start == null || start.isBlank() || end == null || end.isBlank() || start.compareTo(end) <= 0;
    }
}
