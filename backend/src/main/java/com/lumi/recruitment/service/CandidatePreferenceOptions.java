package com.lumi.recruitment.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;

/** Company-supported choices, maintained by the company rather than inferred from candidate data. */
@Service
public class CandidatePreferenceOptions {
    public record Options(List<String> employmentTypes, List<String> workModes, List<String> locations,
                          List<String> positions, List<String> skills) {}
    private final Options options;
    public CandidatePreferenceOptions(
        @Value("${app.candidate-preferences.employment-types}") List<String> employmentTypes,
        @Value("${app.candidate-preferences.work-modes}") List<String> workModes,
        @Value("${app.candidate-preferences.locations}") List<String> locations,
        @Value("${app.candidate-preferences.positions}") List<String> positions,
        @Value("${app.candidate-preferences.skills}") List<String> skills) {
        if (!List.of("FULL_TIME","PART_TIME","INTERNSHIP","CONTRACT").containsAll(employmentTypes)
                || !List.of("ONSITE","HYBRID","REMOTE").containsAll(workModes)) {
            throw new IllegalArgumentException("Invalid company preference configuration");
        }
        this.options = new Options(List.copyOf(employmentTypes), List.copyOf(workModes), List.copyOf(locations),
                List.copyOf(positions),List.copyOf(skills));
    }
    public Options get() { return options; }
    public List<String> validate(List<String> selected, List<String> supported, List<String> previous) {
        if (selected == null) return previous;
        // Retain an existing choice after company settings change, but do not accept new unsupported choices.
        if (selected.stream().anyMatch(s -> !supported.contains(s) && !previous.contains(s)))
            throw new IllegalArgumentException("Lựa chọn chưa được công ty hỗ trợ.");
        return selected.stream().distinct().toList();
    }
}
