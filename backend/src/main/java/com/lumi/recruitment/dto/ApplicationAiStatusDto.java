package com.lumi.recruitment.dto;
import java.time.Instant;
public record ApplicationAiStatusDto(String state,int attempts,int maxAttempts,Instant nextAttemptAt,Integer score,String summary,Instant evaluatedAt) {}
