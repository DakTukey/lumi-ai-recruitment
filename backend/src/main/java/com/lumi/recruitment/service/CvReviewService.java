package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

@Service @RequiredArgsConstructor
public class CvReviewService {
    private final CvWritingService gate;
    private final JobService jobs;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;

    public CvReviewDto.Result review(Authentication auth, CvReviewDto.Request input) {
        return gate.withCapacity(auth, () -> {
            var job = job(input.jobId());
            bounded(input.resume());
            var result = ai.reviewCv(input.resume(), job);
            if (result == null || !text(result.overview(), 1400, false) || result.items() == null || result.items().size() > 6
                || !metadata(result.model_name(), result.prompt_version())) throw invalid();
            var targets = new HashSet<String>();
            for (var item : result.items()) {
                if (item == null || !Set.of("ADD", "CLARIFY", "REWRITE").contains(Objects.toString(item.kind(), ""))
                    || !text(item.reason(), 1000, false) || !text(item.evidence(), 2000, true)
                    || !text(item.job_evidence(), 1000, true) || !text(item.question(), 240, true)
                    || !text(item.suggestion(), 6000, true) || !targets.add(item.section()+":"+item.index())) throw invalid();
                var target = new CvReviewDto.Target(item.section(), item.index());
                String facts;
                String original;
                try { facts = facts(input.resume(), target); original = original(input.resume(), target); }
                catch (ResponseStatusException ex) { throw invalid(); }
                if (!item.evidence().isBlank() && !facts.contains(item.evidence())) throw invalid();
                if (!item.job_evidence().isBlank() && (job == null || !jobText(job).contains(item.job_evidence()))) throw invalid();
                if (item.kind().equals("REWRITE")) {
                    if (original.isBlank() || item.evidence().isBlank() || item.suggestion().isBlank()) throw invalid();
                    validateSuggestion(facts, item.suggestion(), List.of(), result.model_name());
                    checkJobSkills(job, facts, item.suggestion());
                } else if (item.question().isBlank() || !item.suggestion().isBlank()) throw invalid();
            }
            return result;
        });
    }
    public CvReviewDto.Refined refine(Authentication auth, CvReviewDto.RefineRequest input) {
        return gate.withCapacity(auth, () -> {
            bounded(input.resume());
            String facts = facts(input.resume(), input.target());
            var job = job(input.jobId());
            var result = ai.refineCv(input, job);
            if (result == null || !metadata(result.model_name(), result.prompt_version())) throw invalid();
            validateSuggestion(facts+"\n"+input.answer(), result.suggestion(), result.questions(), result.model_name());
            checkJobSkills(job, facts+"\n"+input.answer(), result.suggestion());
            return result;
        });
    }
    private CvReviewDto.JobContext job(UUID id) {
        if (id == null) return null;
        var j = jobs.detail(id); // Fetch the published, currently visible JD from the server.
        return new CvReviewDto.JobContext(j.title(), j.description(), j.requirements(), j.skills(), j.experienceLevel());
    }
    private void bounded(CvReviewDto.Context cv) {
        if (json(cv).length() > 60000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Nội dung CV quá dài để rà soát một lượt. Hãy rút gọn phần mô tả rồi thử lại.");
    }
    String original(CvReviewDto.Context cv, CvReviewDto.Target target) {
        if (target == null || target.section() == null) throw badTarget();
        return switch (target.section()) {
            case "summary" -> { if (target.index() != -1) throw badTarget(); yield Objects.toString(cv.summary(), ""); }
            case "experience" -> Objects.toString(at(cv.experiences(), target.index()).description(), "");
            case "project" -> Objects.toString(at(cv.projects(), target.index()).description(), "");
            default -> throw badTarget();
        };
    }
    private String facts(CvReviewDto.Context cv, CvReviewDto.Target target) {
        original(cv, target); // Validate both section and index before reading any row.
        return switch (target.section()) {
            case "summary" -> plain(cv);
            case "experience" -> plain(at(cv.experiences(), target.index()));
            case "project" -> plain(at(cv.projects(), target.index()));
            default -> throw badTarget();
        };
    }
    private <T> T at(List<T> values, int index) {
        if (index < 0 || index >= values.size()) throw badTarget();
        return values.get(index);
    }
    private String json(Object value) { return mapper.writeValueAsString(value); }
    private String plain(Object value) {
        var parts = new ArrayList<String>(); flatten(mapper.valueToTree(value), parts); return String.join("\n", parts);
    }
    private void flatten(tools.jackson.databind.JsonNode node, List<String> parts) {
        if ((node.isObject() || node.isArray())) for (var child : node) flatten(child, parts);
        else if (!node.isNull() && !node.isBoolean()) parts.add(node.asText());
    }
    private String jobText(CvReviewDto.JobContext j) { return j.title()+"\n"+j.description()+"\n"+j.requirements()+"\n"+String.join("\n",j.skills()); }
    private static boolean text(String value, int max, boolean blank) { return value != null && value.length() <= max && (blank || !value.isBlank()); }
    private static boolean metadata(String model, String version) { return text(model, 200, false) && "cv-review-v1".equals(version); }
    private void checkJobSkills(CvReviewDto.JobContext job, String facts, String suggestion) {
        if (job == null) return;
        for (String skill : job.skills()) {
            var pattern = java.util.regex.Pattern.compile("(?<![\\p{L}\\p{N}_+#])" + java.util.regex.Pattern.quote(skill) + "(?![\\p{L}\\p{N}_+#])", java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.UNICODE_CASE);
            if (pattern.matcher(suggestion).find() && !pattern.matcher(facts).find()) throw invalid();
        }
    }
    private void validateSuggestion(String facts, String suggestion, List<String> questions, String model) {
        if (suggestion != null && java.util.regex.Pattern.compile("(?iu)(\\bbạn\\s+(?:có thể|nên|cần|hãy|đã|muốn)\\b|CV hiện|CV chưa|CV của|cần bổ sung|chưa cung cấp bằng chứng|để tăng sức hấp dẫn|ví dụ\\s*:)").matcher(suggestion).find()) throw invalid();
        CvWritingService.validateResult(new CvWritingDto.Request("summary", "polish", facts, ""),
            new CvWritingDto.Result(suggestion, questions, model, "cv-writing-v1"));
    }
    private ResponseStatusException badTarget() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mục CV đã thay đổi hoặc không tồn tại. Hãy rà soát lại."); }
    private ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Kết quả rà soát chưa hợp lệ. CV của bạn vẫn được giữ nguyên; hãy thử lại."); }
}
