package com.lumi.recruitment.dto;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;
public record JobDto(UUID id, UUID departmentId, String departmentName, String title, int headcount,
 String description, String requirements, String benefits, List<String> skills, String location,
 String employmentType, String workMode, String experienceLevel, BigDecimal salaryMin,
 BigDecimal salaryMax, String currency, boolean featured, Instant publishedAt, Instant applicationDeadline, String positionName, long applicationCount) {}
