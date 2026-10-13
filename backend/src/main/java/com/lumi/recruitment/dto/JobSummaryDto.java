package com.lumi.recruitment.dto;

import java.time.Instant;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public record JobSummaryDto(String jobId, String sourceHash, String promptVersion,
        String modelName, Instant generatedAt, List<Item> items, List<Source> sources) {
    public record Source(String id, String label, String text, List<String> categories) {}
    public record Item(String category, String text, @JsonProperty("source_id") String sourceId, String quote) {}
    public record Result(@JsonProperty("job_id") String jobId,
            @JsonProperty("source_hash") String sourceHash,
            @JsonProperty("prompt_version") String promptVersion,
            @JsonProperty("model_name") String modelName, List<Item> items) {}
}
