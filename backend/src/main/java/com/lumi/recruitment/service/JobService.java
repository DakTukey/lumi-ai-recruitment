package com.lumi.recruitment.service;
import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.recruitment.Job;
import com.lumi.recruitment.entity.recruitment.JobSkill;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class JobService {
 private final JobRepository jobs;
 private final DepartmentRepository departments;
 private final JobSkillRepository jobSkills;
 private final org.springframework.jdbc.core.JdbcTemplate jdbc;
 public record DepartmentDto(UUID id, String name, String description) {}
 public List<DepartmentDto> departments() {
  return departments.findByActiveTrueOrderByNameAsc().stream().map(d -> new DepartmentDto(d.getId(),d.getName(),d.getDescription())).toList();
 }
 private Specification<Job> visible() {
  Instant now = Instant.now();
  return (root,q,cb) -> cb.and(cb.equal(root.get("status"),"PUBLISHED"),
   cb.lessThanOrEqualTo(root.get("publishedAt"),now), cb.isTrue(root.get("department").get("active")),
   cb.or(cb.isNull(root.get("applicationDeadline")),cb.greaterThan(root.get("applicationDeadline"),now)));
 }
 public JobPageDto list(String keyword, UUID departmentId, List<String> levels, List<String> modes,
    BigDecimal minSalary, List<UUID> ids, String sort, int page, int size) {
  if(page<0 || size<1 || size>100 || keyword.length()>200 || (minSalary!=null && minSalary.signum()<0))
   throw new IllegalArgumentException("Bộ lọc không hợp lệ.");
  if(!Set.of("INTERN","JUNIOR","MIDDLE","SENIOR").containsAll(levels) || !Set.of("ONSITE","HYBRID","REMOTE").containsAll(modes))
   throw new IllegalArgumentException("Bộ lọc không hợp lệ.");
  Specification<Job> spec=visible();
  if(!keyword.isBlank()) {
   String term="%"+keyword.trim().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%";
   spec=spec.and((r,q,c)->{
    var matchingSkills=q.subquery(Integer.class);
    var link=matchingSkills.from(JobSkill.class);
    matchingSkills.select(c.literal(1)).where(c.equal(link.get("job").get("id"),r.get("id")),
      c.like(link.get("skill").get("normalizedName"),term,'\\'));
    return c.or(c.like(c.lower(r.get("title")),term,'\\'),c.exists(matchingSkills));
   });
  }
  if(departmentId!=null) spec=spec.and((r,q,c)->c.equal(r.get("department").get("id"),departmentId));
  if(!levels.isEmpty()) spec=spec.and((r,q,c)->r.get("experienceLevel").in(levels));
  if(!modes.isEmpty()) spec=spec.and((r,q,c)->r.get("workMode").in(modes));
  if(minSalary!=null) spec=spec.and((r,q,c)->c.greaterThanOrEqualTo(r.get("salaryMin"),minSalary));
  if(ids!=null) spec=spec.and((r,q,c)->r.get("id").in(ids));
  // Criteria order makes unknown salaries sort last in PostgreSQL.
  if(!Set.of("featured","newest","salary").contains(sort)) throw new IllegalArgumentException("Sắp xếp không hợp lệ.");
  Specification<Job> ordered=spec.and((r,q,c)->{
   if(q.getResultType()!=Long.class && q.getResultType()!=long.class) {
    var orders=new ArrayList<jakarta.persistence.criteria.Order>();
    if(sort.equals("salary")) orders.add(c.desc(c.coalesce(r.<BigDecimal>get("salaryMin"),BigDecimal.valueOf(-1))));
    if(sort.equals("featured")) orders.add(c.desc(r.get("featured")));
    orders.add(c.desc(r.get("publishedAt"))); orders.add(c.asc(r.get("id")));q.orderBy(orders);
    r.fetch("department"); r.fetch("position", jakarta.persistence.criteria.JoinType.LEFT);
   }
   return c.conjunction();
  });
  var result=jobs.findAll(ordered,PageRequest.of(page,size));
  var skills=skillsFor(result.getContent());
  var counts=applicationCountsFor(result.getContent());
  return new JobPageDto(result.stream().map(j->dto(j,skills.getOrDefault(j.getId(),List.of()),counts.getOrDefault(j.getId(),0L))).toList(),page,size,result.getTotalElements(),result.getTotalPages(),result.isFirst(),result.isLast());
 }
 public JobDto detail(UUID id) {
  Job job=jobs.findOne(visible().and((r,q,c)->c.equal(r.get("id"),id)))
   .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy tin đang tuyển."));
  return dto(job,skillsFor(List.of(job)).getOrDefault(id,List.of()),applicationCountsFor(List.of(job)).getOrDefault(id,0L));
 }
 private Map<UUID,List<String>> skillsFor(List<Job> selected) {
  if(selected.isEmpty()) return Map.of();
  Map<UUID,List<String>> result=new HashMap<>();
  for(JobSkill link:jobSkills.findForJobs(selected.stream().map(Job::getId).toList()))
   result.computeIfAbsent(link.getId().getJobId(), ignored->new ArrayList<>()).add(link.getSkill().getName());
  return result;
 }
 /** Total submissions across processing stages. A saved CV or AI match is not an application. */
 private Map<UUID,Long> applicationCountsFor(List<Job> selected) {
  if(selected.isEmpty()) return Map.of();
  var ids=selected.stream().map(Job::getId).toList();
  Map<UUID,Long> counts=new HashMap<>();
  String placeholders=String.join(",",Collections.nCopies(ids.size(),"?"));
  jdbc.query("select job_id,count(*) from recruitment.applications where job_id in ("+placeholders+") group by job_id",
   (rs,n)->Map.entry(rs.getObject(1,UUID.class),rs.getLong(2)),ids.toArray())
   .forEach(entry->counts.put(entry.getKey(),entry.getValue()));
  return counts;
 }
 private JobDto dto(Job j,List<String> skills,long applicationCount) {
  return new JobDto(j.getId(),j.getDepartment().getId(),j.getDepartment().getName(),j.getTitle(),j.getHeadcount(),
   j.getDescription(),j.getRequirements(),j.getBenefits(),skills,
   j.getLocation(),j.getEmploymentType(),j.getWorkMode(),j.getExperienceLevel(),j.getSalaryMin(),j.getSalaryMax(),j.getCurrency(),j.isFeatured(),j.getPublishedAt(),j.getApplicationDeadline(),j.getPosition() == null ? null : j.getPosition().getName(),applicationCount);
 }
}
