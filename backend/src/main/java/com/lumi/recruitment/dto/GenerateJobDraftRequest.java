package com.lumi.recruitment.dto;

public record GenerateJobDraftRequest(
    String title,
    String level,
    String location,
    String mode,
    String skills,
    String requirements,
    String tone
) {}
