package com.lumi.recruitment.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Staff-only response. Never returned from candidate endpoints. */
public record ApplicationReviewDto(ApplicationDto application, List<NoteDto> notes,
 List<HistoryDto> history, List<String> allowedTransitions) {
 public record NoteDto(UUID id, String body, UUID authorId, String authorName, Instant at) {}
 public record HistoryDto(UUID id, String fromStatus, String toStatus, UUID actorId,
  String actorName, String reason, Instant at) {}
}
