package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.entity.recruitment.*;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class RecruiterJobService {
    private final UserRepository users;
    private final DepartmentRepository departments;
    private final JobPositionRepository positions;
    private final JobRepository jobs;
    private final SkillRepository skills;
    private final JobSkillRepository links;
    private final JobRequirementRepository criteria;
    private final JobHistoryRepository histories;
    private final JdbcTemplate jdbc;
    private final jakarta.validation.Validator validator;
    private User staff(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên không còn hợp lệ.");
        User user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.RECRUITER && user.getRole() != UserRole.COMPANY_ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ dành cho nhân sự tuyển dụng.");
        return user;
    }
    private ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    public record PositionDto(UUID id, UUID departmentId, String name) {}
    public List<PositionDto> positions(Authentication auth, UUID departmentId) {
        staff(auth);
        departments.findById(departmentId).filter(Department::isActive)
                .orElseThrow(() -> invalid("Chọn phòng ban đang hoạt động."));
        return positions.findByDepartmentIdAndActiveTrueOrderByNameAsc(departmentId).stream()
                .map(p -> new PositionDto(p.getId(), departmentId, p.getName())).toList();
    }
    private JobPosition validPosition(UUID positionId, UUID departmentId) {
        if (positionId == null) throw invalid("Chọn vị trí tuyển dụng.");
        return positions.findById(positionId)
                .filter(p -> p.isActive() && p.getDepartment().getId().equals(departmentId))
                .orElseThrow(() -> invalid("Vị trí không thuộc phòng ban đã chọn hoặc đã ngừng sử dụng."));
    }
    @Transactional
    public JobService.DepartmentDto createDepartment(Authentication auth, String name) {
        staff(auth);
        String cleaned = name.trim().replaceAll("\\s+", " ");
        if (departments.existsByNameIgnoreCase(cleaned))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phòng ban này đã tồn tại.");
        Department d = new Department(); d.setName(cleaned);
        departments.saveAndFlush(d);
        return new JobService.DepartmentDto(d.getId(), d.getName(), d.getDescription());
    }
    @Transactional
    public RecruiterJobDto create(Authentication auth, CreateJobRequest input) {
        User author = staff(auth);
        Department department = validateContent(input);
        Job j = new Job(); Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        applyContent(j, input, department);
        j.setCreatedBy(author); j.setUpdatedBy(author);
        j.setStatus("DRAFT"); j.setFeatured(false); j.setPublishedAt(null);
        j.setCreatedAt(now); j.setUpdatedAt(now); jobs.saveAndFlush(j);
        replaceRelations(j, input);
        JobHistory history = new JobHistory(); history.setJob(j); history.setChangedBy(author);
        history.setAction(JobHistoryAction.CREATED); history.setToStatus("DRAFT"); history.setNote("Tạo bản nháp tuyển dụng.");
        history.setChanges(Map.of("title", j.getTitle(), "headcount", j.getHeadcount(), "departmentId", department.getId().toString()));
        histories.saveAndFlush(history);
        return dto(j, true);
    }
    private Department validateContent(CreateJobRequest input) {
        Department department = departments.findById(input.departmentId()).filter(Department::isActive)
                .orElseThrow(() -> invalid("Chọn phòng ban đang hoạt động."));
        validPosition(input.positionId(), department.getId());
        if (input.salaryMin() != null && input.salaryMax() != null && input.salaryMin().compareTo(input.salaryMax()) > 0)
            throw invalid("Mức lương đến phải bằng hoặc lớn hơn mức lương từ.");
        // Use the same PostgreSQL normalization as the unique catalog key, including whitespace.
        Set<String> names = new HashSet<>();
        for (var skill : input.skills()) {
            String normalized = jdbc.queryForObject("select catalog.normalize_skill_name(?)", String.class, skill.name());
            if (normalized.isEmpty() || !names.add(normalized)) throw invalid("Kỹ năng không được để trống hoặc trùng nhau.");
        }
        if (input.applicationDeadline() != null && (input.applicationDeadline().getYear() < 1 || input.applicationDeadline().getYear() > 9999))
            throw invalid("Hạn nộp không hợp lệ.");
        return department;
    }
    private void applyContent(Job j, CreateJobRequest input, Department department) {
        j.setDepartment(department);
        j.setPosition(validPosition(input.positionId(), department.getId()));
        j.setTitle(input.title().trim()); j.setHeadcount(input.headcount().intValueExact());
        j.setDescription(input.description().trim()); j.setRequirements(input.requirements().trim());
        j.setBenefits(input.benefits().trim()); j.setLocation(input.location().trim());
        j.setEmploymentType(input.employmentType().name()); j.setWorkMode(input.workMode().name());
        j.setExperienceLevel(input.experienceLevel().name()); j.setSalaryMin(input.salaryMin()); j.setSalaryMax(input.salaryMax());
        j.setCurrency("VND");
        // An optional draft deadline may already be in the past; publication must validate it later.
        j.setApplicationDeadline(input.applicationDeadline() == null ? null : input.applicationDeadline().plusDays(1)
                .atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().minusNanos(1000));
    }
    private void replaceRelations(Job j, CreateJobRequest input) {
        // Remove old relations before reusing a composite job/skill key.
        links.deleteAll(links.findForJobs(List.of(j.getId()))); links.flush();
        criteria.deleteAll(criteria.findByJobIdOrderBySortOrderAscIdAsc(j.getId())); criteria.flush();
        for (var item : input.skills()) {
            jdbc.update("insert into catalog.skills(name) values (?) on conflict (normalized_name) do nothing", item.name().trim().replaceAll("\\s+", " "));
            String normalized = jdbc.queryForObject("select catalog.normalize_skill_name(?)", String.class, item.name());
            var skill = skills.findByNormalizedName(normalized).orElseThrow();
            if (!skill.isActive()) throw invalid("Kỹ năng “" + skill.getName() + "” đã ngừng sử dụng. Hãy chọn kỹ năng khác.");
            JobSkill link = new JobSkill(); link.setJob(j); link.setSkill(skill); link.setRequired(item.required()); links.save(link);
        }
        for (int index = 0; index < input.criteria().size(); index++) {
            var item = input.criteria().get(index); JobRequirement criterion = new JobRequirement();
            criterion.setJob(j); criterion.setType(item.type()); criterion.setDescription(item.description().trim());
            criterion.setRequired(item.required()); criterion.setWeight(item.weight()); criterion.setSortOrder(index); criteria.save(criterion);
        }
    }
    private Job writableJob(UUID id, long version) {
        Job j = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin tuyển dụng."));
        if (j.getVersion() != version)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tin vừa được người khác cập nhật. Hãy tải lại tin trước khi thao tác tiếp.");
        return j;
    }
    private Instant now() { return Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS); }
    private void record(Job j, User actor, JobHistoryAction action, String from, String note, Map<String, Object> changes) {
        JobHistory h = new JobHistory(); h.setJob(j); h.setChangedBy(actor); h.setAction(action);
        h.setFromStatus(from); h.setToStatus(j.getStatus()); h.setNote(note); h.setChanges(changes); histories.saveAndFlush(h);
    }
    @Transactional
    public RecruiterJobDto update(Authentication auth, UUID id, UpdateJobRequest input) {
        User actor = staff(auth); Job j = writableJob(id, input.version());
        if (!Set.of("DRAFT", "CLOSED").contains(j.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hãy đóng tin đang tuyển trước khi sửa nội dung.");
        Department department = validateContent(input.content());
        var before = contentSnapshot(j); String from = j.getStatus();
        applyContent(j, input.content(), department);
        if (j.getPublishedAt() != null && j.getApplicationDeadline() != null && !j.getApplicationDeadline().isAfter(j.getPublishedAt()))
            throw invalid("Hạn nộp phải sau thời điểm đăng tin lần đầu.");
        j.setUpdatedBy(actor); j.setUpdatedAt(now());
        // Claim the version before modifying children; any later failure rolls back all writes.
        jobs.saveAndFlush(j); replaceRelations(j, input.content());
        record(j, actor, JobHistoryAction.UPDATED, from, "Cập nhật nội dung tin tuyển dụng.",
                Map.of("before", before, "after", contentSnapshot(j)));
        return dto(j, true);
    }
    @Transactional
    public RecruiterJobDto transition(Authentication auth, UUID id, long version, JobHistoryAction action) {
        User actor = staff(auth); Job j = writableJob(id, version);
        String expected = switch (action) {
            case PUBLISHED -> "DRAFT";
            case CLOSED -> "PUBLISHED";
            case REOPENED -> "CLOSED";
            default -> throw invalid("Thao tác không hợp lệ.");
        };
        if (!expected.equals(j.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Trạng thái tin đã thay đổi hoặc không phù hợp với thao tác này. Hãy tải lại tin.");
        Instant time = now();
        if (action != JobHistoryAction.CLOSED) {
            CreateJobRequest content = storedContent(j);
            if (!validator.validate(content).isEmpty())
                throw invalid("Tin chưa đủ thông tin hợp lệ. Hãy sửa nội dung trước khi đăng hoặc mở lại.");
            validateContent(content);
            if (j.getApplicationDeadline() != null && !j.getApplicationDeadline().isAfter(time))
                throw invalid("Hạn nhận hồ sơ đã qua. Hãy sửa hạn nộp trước khi đăng hoặc mở lại.");
            if (links.findForJobs(List.of(id)).stream().anyMatch(link -> !link.getSkill().isActive()))
                throw invalid("Tin có kỹ năng đã ngừng sử dụng. Hãy sửa kỹ năng trước khi đăng hoặc mở lại.");
        }
        j.setStatus(action == JobHistoryAction.CLOSED ? "CLOSED" : "PUBLISHED");
        // Reopening keeps the original publication date rather than promoting the job as new.
        if (action != JobHistoryAction.CLOSED && j.getPublishedAt() == null) j.setPublishedAt(time);
        j.setUpdatedBy(actor); j.setUpdatedAt(time); jobs.saveAndFlush(j);
        String note = switch (action) {
            case PUBLISHED -> "Đăng tin tuyển dụng.";
            case CLOSED -> "Đóng tin tuyển dụng.";
            case REOPENED -> "Mở lại tin tuyển dụng.";
            default -> throw invalid("Thao tác không hợp lệ.");
        };
        record(j, actor, action, expected, note, Map.of("fromStatus", expected, "toStatus", j.getStatus()));
        return dto(j, true);
    }
    private CreateJobRequest storedContent(Job j) {
        try {
            return new CreateJobRequest(j.getDepartment().getId(), j.getPosition() == null ? null : j.getPosition().getId(), j.getTitle(), new java.math.BigDecimal(j.getHeadcount()),
                    j.getDescription(), j.getRequirements(), j.getBenefits(), j.getLocation(),
                    CreateJobRequest.EmploymentType.valueOf(j.getEmploymentType()), CreateJobRequest.WorkMode.valueOf(j.getWorkMode()),
                    CreateJobRequest.ExperienceLevel.valueOf(j.getExperienceLevel()), j.getSalaryMin(), j.getSalaryMax(),
                    j.getApplicationDeadline() == null ? null : j.getApplicationDeadline().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate(),
                    links.findForJobs(List.of(j.getId())).stream().map(l -> new CreateJobRequest.SkillInput(l.getSkill().getName(), l.isRequired())).toList(),
                    criteria.findByJobIdOrderBySortOrderAscIdAsc(j.getId()).stream().map(c -> new CreateJobRequest.CriterionInput(c.getType(), c.getDescription(), c.isRequired(), c.getWeight())).toList());
        } catch (IllegalArgumentException e) { throw invalid("Tin có mã dữ liệu không hợp lệ. Hãy sửa nội dung trước khi đăng."); }
    }
    private Map<String, Object> contentSnapshot(Job j) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("departmentId", j.getDepartment().getId().toString()); result.put("title", j.getTitle()); result.put("headcount", j.getHeadcount());
        result.put("positionId", j.getPosition() == null ? null : j.getPosition().getId().toString());
        result.put("positionName", j.getPosition() == null ? null : j.getPosition().getName());
        result.put("description", j.getDescription()); result.put("requirements", j.getRequirements()); result.put("benefits", j.getBenefits());
        result.put("location", j.getLocation()); result.put("employmentType", j.getEmploymentType()); result.put("workMode", j.getWorkMode());
        result.put("experienceLevel", j.getExperienceLevel()); result.put("salaryMin", j.getSalaryMin()); result.put("salaryMax", j.getSalaryMax());
        result.put("applicationDeadline", j.getApplicationDeadline() == null ? null : j.getApplicationDeadline().toString());
        result.put("skills", links.findForJobs(List.of(j.getId())).stream().map(s -> Map.of("name", s.getSkill().getName(), "required", s.isRequired())).toList());
        result.put("criteria", criteria.findByJobIdOrderBySortOrderAscIdAsc(j.getId()).stream().map(r -> Map.of("type", r.getType().name(), "description", r.getDescription(), "required", r.isRequired(), "weight", r.getWeight())).toList());
        return result;
    }
    public RecruiterJobDto.PageDto list(Authentication auth, String keyword, UUID departmentId, String status, int page, int size) {
        staff(auth);
        if (keyword.length() > 200 || page < 0 || size < 1 || size > 100 || !Set.of("", "DRAFT", "PUBLISHED", "CLOSED").contains(status))
            throw invalid("Bộ lọc tin tuyển dụng không hợp lệ.");
        Specification<Job> spec = (r, q, c) -> c.conjunction();
        if (departmentId != null) spec = spec.and((r, q, c) -> c.equal(r.get("department").get("id"), departmentId));
        if (!status.isEmpty()) spec = spec.and((r, q, c) -> c.equal(r.get("status"), status));
        if (!keyword.isBlank()) {
            String term = "%" + keyword.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, c) -> {
                var sub = q.subquery(Integer.class); var link = sub.from(JobSkill.class);
                sub.select(c.literal(1)).where(c.equal(link.get("job").get("id"), r.get("id")), c.like(link.get("skill").get("normalizedName"), term, '\\'));
                return c.or(c.like(c.lower(r.get("title")), term, '\\'), c.exists(sub));
            });
        }
        var result = jobs.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("id"))));
        return new RecruiterJobDto.PageDto(result.stream().map(j -> dto(j, false)).toList(), page, size,
                result.getTotalElements(), result.getTotalPages(), result.isFirst(), result.isLast());
    }
    public RecruiterJobDto detail(Authentication auth, UUID id) {
        staff(auth); return dto(jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tin tuyển dụng.")), true);
    }
    private RecruiterJobDto dto(Job j, boolean includeHistory) {
        var skillDtos = links.findForJobs(List.of(j.getId())).stream().map(link -> new RecruiterJobDto.SkillDto(link.getSkill().getId(), link.getSkill().getName(), link.isRequired())).toList();
        var criterionDtos = criteria.findByJobIdOrderBySortOrderAscIdAsc(j.getId()).stream().map(c -> new RecruiterJobDto.CriterionDto(c.getId(), c.getType(), c.getDescription(), c.isRequired(), c.getWeight(), c.getSortOrder())).toList();
        var historyDtos = includeHistory ? histories.findByJobIdOrderByCreatedAtDescIdAsc(j.getId(), PageRequest.of(0, 50)).stream()
                .map(h -> new RecruiterJobDto.HistoryDto(h.getId(), h.getAction().name(), h.getChangedBy().getFullName(), h.getNote(), h.getCreatedAt())).toList() : List.<RecruiterJobDto.HistoryDto>of();
        return new RecruiterJobDto(j.getId(), j.getDepartment().getId(), j.getDepartment().getName(),
                j.getPosition() == null ? null : j.getPosition().getId(), j.getPosition() == null ? null : j.getPosition().getName(), j.getTitle(), j.getHeadcount(),
                j.getDescription(), j.getRequirements(), j.getBenefits(), j.getLocation(), j.getEmploymentType(), j.getWorkMode(), j.getExperienceLevel(),
                j.getSalaryMin(), j.getSalaryMax(), j.getCurrency(), j.getStatus(), j.getPublishedAt(), j.getApplicationDeadline(), j.getCreatedAt(), j.getUpdatedAt(),
                j.getVersion(), skillDtos, criterionDtos, historyDtos);
    }
}
