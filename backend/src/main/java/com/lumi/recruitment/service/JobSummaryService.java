package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.JobSummaryDto;
import com.lumi.recruitment.dto.JobSummaryDto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Semaphore;

@Service @RequiredArgsConstructor
public class JobSummaryService {
    static final String PROMPT_VERSION = "job-summary-v2";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AiServiceClient ai;
    // Bound provider concurrency independently from the web server's thread pool.
    private final Semaphore providerSlots = new Semaphore(2);
    private record Input(String hash, List<Source> sources) {}

    @Transactional(readOnly = true)
    public JobSummaryDto cached(UUID id) {
        return cached(id, input(id));
    }

    @Transactional
    public JobSummaryDto generate(UUID id) {
        Input input = input(id); // Only currently published, open jobs are eligible.
        var existing = cached(id, input);
        if (existing != null) return existing;
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
                "select pg_try_advisory_xact_lock(hashtextextended(?,0))", Boolean.class, "job-summary:" + id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Bản tóm tắt đang được tạo. Vui lòng thử lại sau ít giây.");
        input = input(id);
        existing = cached(id, input);
        if (existing != null) return existing;
        if (!providerSlots.tryAcquire())
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "AI đang bận. Vui lòng thử lại sau ít giây.");
        Result result;
        try { result = ai.summarizeJob(id.toString(), input.hash(), input.sources()); }
        finally { providerSlots.release(); }
        validate(id, input, result);
        // A fresh SQL snapshot avoids JPA's first-level cache if HR edited during generation.
        if (!input.hash().equals(input(id).hash()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Tin tuyển dụng vừa thay đổi. Hãy tải lại trang để xem nội dung mới.");
        var finalItems = groundedSkills(input, result.items());
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        jdbc.update("""
            insert into recruitment.job_ai_summaries(job_id,source_hash,prompt_version,model_name,items,generated_at)
            values (?,?,?,?,?::jsonb,?) on conflict(job_id) do update set
              source_hash=excluded.source_hash,prompt_version=excluded.prompt_version,
              model_name=excluded.model_name,items=excluded.items,generated_at=excluded.generated_at
            """, id, input.hash(), PROMPT_VERSION, result.modelName(), mapper.writeValueAsString(finalItems),
            java.sql.Timestamp.from(now));
        return dto(id, input, result.modelName(), now, finalItems);
    }

    private List<Item> groundedSkills(Input input, List<Item> items) {
        Map<String, Source> sources = new HashMap<>(); input.sources().forEach(s -> sources.put(s.id(), s));
        return items.stream().map(item -> {
            var source = sources.get(item.sourceId());
            return source.id().startsWith("skill:") ? new Item(item.category(),source.text(),source.id(),source.text()) : item;
        }).distinct().toList();
    }

    private JobSummaryDto cached(UUID id, Input input) {
        var rows = jdbc.query("""
            select model_name,items::text,generated_at from recruitment.job_ai_summaries
            where job_id=? and source_hash=? and prompt_version=?
            """, (rs, n) -> dto(id, input, rs.getString(1), rs.getTimestamp(3).toInstant(),
                List.of(mapper.readValue(rs.getString(2), Item[].class))), id, input.hash(), PROMPT_VERSION);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private JobSummaryDto dto(UUID id, Input input, String model, Instant at, List<Item> items) {
        return new JobSummaryDto(id.toString(), input.hash(), PROMPT_VERSION, model, at, items, input.sources());
    }

    private void validate(UUID id, Input input, Result result) {
        boolean valid = result != null && id.toString().equals(result.jobId())
            && input.hash().equals(result.sourceHash()) && PROMPT_VERSION.equals(result.promptVersion())
            && result.modelName() != null && !result.modelName().isBlank() && result.modelName().length() <= 100
            && result.items() != null && !result.items().isEmpty() && result.items().size() <= 16;
        Map<String, Source> sources = new HashMap<>(); input.sources().forEach(s -> sources.put(s.id(), s));
        Map<String, Integer> counts = new HashMap<>(); Set<String> seen = new HashSet<>();
        if (valid) for (Item item : result.items()) {
            if (item == null) { valid = false; break; }
            var source = sources.get(item.sourceId());
            if (source == null || !source.categories().contains(item.category())
                || item.text() == null || item.text().isBlank() || item.text().length() > 350
                || item.quote() == null || item.quote().isBlank() || item.quote().length() > 800
                || !source.text().contains(item.quote())
                || counts.merge(item.category(), 1, Integer::sum) > 4
                || !seen.add(item.category() + ":" + item.text().strip().toLowerCase(Locale.ROOT))) {
                valid = false; break;
            }
        }
        if (!valid) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
            "AI chưa tạo được bản tóm tắt có căn cứ hợp lệ. Vui lòng thử lại.");
    }

    private Input input(UUID id) {
        // One statement gives a consistent snapshot of the JD and its child tables.
        var rows = jdbc.queryForList("""
            select jsonb_build_object('title',j.title,'department',d.name,'version',j.version,
              'description',j.description,'requirements',j.requirements,'benefits',j.benefits,
              'location',j.location,'employmentType',j.employment_type,'workMode',j.work_mode,
              'experienceLevel',j.experience_level,'headcount',j.headcount,
              'salaryMin',j.salary_min,'salaryMax',j.salary_max,'currency',j.currency,
              'deadline',j.application_deadline,
              'skills',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'required',js.is_required) order by s.id)
                from recruitment.job_skills js join catalog.skills s on s.id=js.skill_id where js.job_id=j.id),'[]'::jsonb),
              'criteria',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'description',r.description,'required',r.is_required)
                order by r.sort_order,r.id) from recruitment.job_requirements r where r.job_id=j.id),'[]'::jsonb))::text
            from recruitment.jobs j join recruitment.departments d on d.id=j.department_id
            where j.id=? and j.status='PUBLISHED' and j.published_at<=statement_timestamp()
              and d.is_active and (j.application_deadline is null or j.application_deadline>statement_timestamp())
            """, String.class, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin đang tuyển.");
        String json = rows.getFirst(); JsonNode data = mapper.readTree(json);
        List<Source> sources = new ArrayList<>();
        add(sources, "title", "Vị trí tuyển dụng", data.path("title").asText(), "notes");
        add(sources, "description", "Mô tả công việc", data.path("description").asText(), "responsibilities");
        add(sources, "requirements", "Yêu cầu", data.path("requirements").asText(), "required", "preferred", "notes");
        add(sources, "benefits", "Quyền lợi", data.path("benefits").asText(), "notes");
        var employment = Map.of("FULL_TIME","Toàn thời gian","PART_TIME","Bán thời gian","INTERNSHIP","Thực tập","CONTRACT","Hợp đồng");
        var modes = Map.of("ONSITE","Tại văn phòng","HYBRID","Hybrid","REMOTE","Remote");
        add(sources, "facts", "Thông tin vị trí", "Phòng ban: " + data.path("department").asText()
            + "\nĐịa điểm: " + data.path("location").asText()
            + "\nHình thức: " + employment.getOrDefault(data.path("employmentType").asText(), data.path("employmentType").asText())
            + "\nLàm việc: " + modes.getOrDefault(data.path("workMode").asText(), data.path("workMode").asText())
            + "\nCấp bậc: " + data.path("experienceLevel").asText()
            + "\nSố lượng: " + data.path("headcount").asInt()
            + "\nLương tối thiểu: " + nullable(data.path("salaryMin")) + " " + data.path("currency").asText()
            + "\nLương tối đa: " + nullable(data.path("salaryMax")) + " " + data.path("currency").asText()
            + "\nHạn ứng tuyển: " + nullable(data.path("deadline")), "notes");
        for (JsonNode skill : data.path("skills")) add(sources, "skill:" + skill.path("id").asText(), "Kỹ năng",
            (skill.path("required").asBoolean() ? "Bắt buộc: " : "Ưu tiên: ") + skill.path("name").asText(),
            skill.path("required").asBoolean() ? "required" : "preferred");
        for (JsonNode criterion : data.path("criteria")) add(sources, "criterion:" + criterion.path("id").asText(), "Tiêu chí tuyển dụng",
            (criterion.path("required").asBoolean() ? "Bắt buộc: " : "Ưu tiên: ") + criterion.path("description").asText(),
            criterion.path("required").asBoolean() ? "required" : "preferred");
        if (sources.size() > 220 || sources.stream().mapToInt(s -> s.text().length()).sum() > 100000
            || sources.stream().anyMatch(s -> s.text().length() > 30000))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT, "Tin quá dài để tóm tắt. Vui lòng đọc JD bên dưới.");
        try {
            return new Input(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((PROMPT_VERSION + "\n" + json).getBytes(StandardCharsets.UTF_8))), List.copyOf(sources));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static String nullable(JsonNode value) {
        return value.isNull() ? "Chưa công bố" : value.isNumber() ? value.decimalValue().toPlainString() : value.asText();
    }
    private static void add(List<Source> sources, String id, String label, String text, String... categories) {
        if (text != null && !text.isBlank()) sources.add(new Source(id, label, text.strip(), List.of(categories)));
    }
}
