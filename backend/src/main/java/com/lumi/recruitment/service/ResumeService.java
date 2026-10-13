package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.entity.candidate.*;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor
public class ResumeService {
    private final UserRepository users;
    private final CandidateProfileRepository profiles;
    private final ResumeRepository resumes;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final UniversityCatalogService universityCatalog;

    private CandidateProfile owner(Authentication auth, boolean write) {
        User user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.CANDIDATE) throw new AccessDeniedException("Chỉ dành cho ứng viên.");
        return (write ? profiles.findForResumeWrite(user.getId()) : profiles.findById(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ."));
    }
    private Resume owned(UUID id, CandidateProfile owner) {
        return resumes.findByIdAndCandidate_UserId(id, owner.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy CV."));
    }
    private void checkVersion(Resume resume, Long version) {
        if (version == null || version != resume.getVersion())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CV đã thay đổi. Hãy mở lại bản mới nhất trước khi lưu.");
    }
    @Transactional(readOnly=true)
    public List<String> positionOptions() {
        return jdbc.queryForList("""
                select distinct trim(p.name) as name
                from recruitment.job_positions p
                join recruitment.departments d on d.id = p.department_id
                where p.is_active = true and d.is_active = true and trim(p.name) <> ''
                order by name
                """, String.class);
    }
    @Transactional(readOnly=true)
    public List<String> skillOptions() {
        return jdbc.queryForList("""
                select distinct trim(name) as name
                from catalog.skills
                where is_active = true and trim(name) <> ''
                order by name
                """, String.class);
    }
    @Transactional(readOnly=true)
    public List<UniversityOptionDto> universityOptions() {
        return universityCatalog.getUniversities();
    }
    @Transactional(readOnly=true)
    public List<ResumeDto> list(Authentication auth) {
        return resumes.findByCandidate_UserIdOrderByUpdatedAtDesc(owner(auth, false).getUserId()).stream().map(ResumeService::dto).toList();
    }
    @Transactional(readOnly=true)
    public ResumeDto get(Authentication auth, UUID id) { return dto(owned(id, owner(auth, false))); }
    @Transactional
    public ResumeDto save(Authentication auth, UUID id, ResumeRequest input) {
        CandidateProfile owner = owner(auth, true);
        Resume r;
        if (id == null) {
            r = new Resume(); r.setCandidate(owner); r.setCreatedAt(Instant.now());
        } else {
            r = owned(id, owner); checkVersion(r, input.version());
        }
        if (input.status() == ResumeStatus.READY && (blank(input.fullName()) || blank(input.email()) || blank(input.desiredPosition())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Để hoàn tất CV, hãy điền họ tên, email và vị trí ứng tuyển.");
        r.setTitle(input.title().trim()); r.setFullName(clean(input.fullName())); r.setEmail(clean(input.email()));
        r.setPhone(clean(input.phone())); r.setLocation(clean(input.location())); r.setDesiredPosition(clean(input.desiredPosition()));
        r.setSummary(clean(input.summary())); r.setGithubUrl(clean(input.githubUrl()));
        r.setLinkedinUrl(clean(input.linkedinUrl())); r.setPortfolioUrl(clean(input.portfolioUrl()));
        r.setSkills(normalizeSkills(input.skills()));
        r.setExperiences(List.copyOf(input.experiences())); r.setEducations(List.copyOf(input.educations()));
        r.setProjects(input.projects().stream().map(p -> new com.lumi.recruitment.entity.candidate.ResumeSections.Project(
            p.name(), p.role(), p.url(), p.description(), p.startDate(), p.endDate(), p.current(),
            normalizeSkills(p.technologies()))).toList());
        r.setCertifications(List.copyOf(input.certifications()));
        // Older clients omit these sections; preserve existing answers on update.
        if (input.languages() != null) r.setLanguages(List.copyOf(input.languages()));
        if (input.awards() != null) r.setAwards(List.copyOf(input.awards()));
        if (input.activities() != null) r.setActivities(List.copyOf(input.activities()));
        r.setTemplate(input.template()); r.setStatus(input.status());
        if (input.status() == ResumeStatus.DRAFT) r.setDefaultResume(false);
        r.setUpdatedAt(Instant.now());
        return dto(resumes.saveAndFlush(r));
    }
    @Transactional
    public ResumeDto makeDefault(Authentication auth, UUID id, long version) {
        CandidateProfile owner = owner(auth, true);
        Resume target = owned(id, owner); checkVersion(target, version);
        if (target.getStatus() != ResumeStatus.READY)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hãy hoàn tất CV trước khi đặt mặc định.");
        var previous = resumes.findByCandidate_UserIdAndDefaultResumeTrue(owner.getUserId());
        if (previous.isPresent() && !previous.get().getId().equals(id)) {
            previous.get().setDefaultResume(false); previous.get().setUpdatedAt(Instant.now()); resumes.flush();
        }
        target.setDefaultResume(true); target.setUpdatedAt(Instant.now()); resumes.flush();
        return dto(target);
    }
    @Transactional
    public void delete(Authentication auth, UUID id, long version) {
        Resume r = owned(id, owner(auth, true)); checkVersion(r, version);
        if (Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where resume_id=?)", Boolean.class, id)))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "CV đã dùng để ứng tuyển không thể xóa. Bạn vẫn có thể chỉnh sửa hoặc tạo CV mới.");
        resumes.delete(r); resumes.flush();
    }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    static List<String> normalizeSkills(List<String> values) {
        var unique = new LinkedHashMap<String, String>();
        if (values != null) for (String value : values) {
            String name = value.trim().replaceAll("\\s+", " ");
            if (!name.isBlank()) unique.putIfAbsent(name.toLowerCase(Locale.ROOT), name);
        }
        return List.copyOf(unique.values());
    }
    private String clean(String value) { return blank(value) ? null : value.trim(); }
    public static ResumeDto dto(Resume r) {
        return new ResumeDto(r.getId(), r.getCandidate().getUserId(), r.getTitle(), r.getFullName(), r.getEmail(),
                r.getPhone(), r.getLocation(), r.getDesiredPosition(), r.getSummary(), r.getGithubUrl(), r.getLinkedinUrl(),
                r.getPortfolioUrl(), r.getSkills(), r.getExperiences(), r.getEducations(), r.getProjects(), r.getCertifications(),
                r.getLanguages(), r.getAwards(), r.getActivities(),
                r.getTemplate(), r.getStatus(), r.isDefaultResume(), r.getVersion(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
