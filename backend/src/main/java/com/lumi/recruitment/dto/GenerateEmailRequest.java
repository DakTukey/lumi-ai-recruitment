package com.lumi.recruitment.dto;

public record GenerateEmailRequest(
    String templateType,
    String interviewTime,
    String interviewFormat,
    String interviewLocation,
    String salaryOffer,
    String startDate,
    String rejectionReason,
    String additionalNotes,
    String tone
) {}
