package com.lumi.recruitment.dto;
import java.time.Instant;
import java.util.*;

public record ApplicationDto(UUID id, UUID jobId, UUID candidateId, UUID resumeId, String status,
 String coverLetter, long jobVersion, long version, Instant appliedAt, Instant updatedAt,
 RecruiterJobDto jobSnapshot, ResumeDto resumeSnapshot, List<HistoryDto> history, String submissionFormat, UUID sourceDocumentId) {
 public record HistoryDto(UUID id, String fromStatus, String toStatus, Instant at) {}
 public record Item(UUID id, UUID jobId, String jobTitle, String name, String email,
  String resumeTitle, String status, Instant appliedAt, Integer aiScore, String aiSummary, Instant assessedAt) {}
 public record PageDto(List<Item> content, int page, int size, long totalElements, int totalPages) {}
 public record Summary(long total, Map<String,Long> stages, List<JobCount> jobs, long assessed, List<Item> priority) {}
 public record JobCount(UUID jobId, String title, long count) {}
}
