package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.entity.candidate.ResumeStatus;
import com.lumi.recruitment.entity.recruitment.Job;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class ApplicationService {
 private final UserRepository users;
 private final CandidateProfileRepository profiles;
 private final ResumeRepository resumes;
 private final JobRepository jobs;
 private final JobSkillRepository skills;
 private final JobRequirementRepository criteria;
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 private final AssessmentContext assessmentContexts;
 private final AiAnalysisTaskService aiTasks;
 private static final List<String> STAGES = List.of("SUBMITTED","REVIEWING","INTERVIEW","OFFER","HIRED","REJECTED","WITHDRAWN");
 private User actor(Authentication auth, boolean staff) {
  if(auth==null) throw new BadCredentialsException("Hãy đăng nhập để tiếp tục.");
  User u=users.findByEmail(auth.getName()).filter(v->v.getStatus()==UserStatus.ACTIVE)
   .orElseThrow(()->new BadCredentialsException("Phiên không còn hợp lệ."));
  if(staff ? (u.getRole()!=UserRole.RECRUITER && u.getRole()!=UserRole.COMPANY_ADMIN) : u.getRole()!=UserRole.CANDIDATE)
   throw new AccessDeniedException("Bạn không có quyền truy cập hồ sơ này.");
  return u;
 }
 private ResponseStatusException conflict(String text) { return new ResponseStatusException(HttpStatus.CONFLICT,text); }
 @Transactional
 public ApplicationDto submit(Authentication auth, SubmitApplicationRequest input) {
  User u=actor(auth,false);
  // Job writers acquire this row before changing related skills/criteria. CV writers lock the profile.
  Job j=jobs.findForApplication(input.jobId()).orElseThrow(()->conflict("Tin không còn nhận hồ sơ."));
  var activeDepartment=jdbc.queryForObject("select is_active from recruitment.departments where id=? for share",Boolean.class,j.getDepartment().getId());
  profiles.findForResumeWrite(u.getId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Chưa có hồ sơ ứng viên."));
  Instant now=Instant.now();
  if(!"PUBLISHED".equals(j.getStatus()) || j.getPublishedAt()==null || j.getPublishedAt().isAfter(now)
   || !Boolean.TRUE.equals(activeDepartment) || (j.getApplicationDeadline()!=null && !j.getApplicationDeadline().isAfter(now)))
   throw conflict("Tin không còn nhận hồ sơ. Hãy chọn công việc khác.");
  if(Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from recruitment.applications where job_id=? and candidate_id=?)",Boolean.class,j.getId(),u.getId())))
   throw conflict("Bạn đã nộp đơn cho công việc này. Hãy xem trong Đơn ứng tuyển.");
  var r=resumes.findByIdAndCandidate_UserId(input.resumeId(),u.getId())
   .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy CV của bạn."));
  if(r.getStatus()!=ResumeStatus.READY) throw conflict("Hãy hoàn tất CV trước khi nộp đơn.");
  if(r.getVersion()!=input.resumeVersion()) throw conflict("CV vừa thay đổi. Hãy tải lại và xem bản mới trước khi nộp.");
  UUID id=UUID.randomUUID();
  String letter=input.coverLetter()==null || input.coverLetter().isBlank()?null:input.coverLetter().trim();
  String format=input.submissionFormat()==null?"BUILDER":input.submissionFormat();
  UUID document="ORIGINAL_PDF".equals(format)?r.getSourceDocumentId():null;
  var resumeContent=mapper.valueToTree(ResumeService.dto(r));
  if ("ORIGINAL_PDF".equals(format)) {
   var originals=jdbc.query("select parsed_content::text from candidate.resume_documents where id=? and candidate_id=? and status='PARSED'",(rs,n)->rs.getString(1),document,u.getId());
   if(originals.isEmpty()) throw conflict("CV này chưa có PDF gốc hợp lệ.");
   var parsed=mapper.readTree(originals.getFirst());
   // Score the extraction of the chosen original, never later edits in the builder.
   for(String field:List.of("fullName","email","phone","location","desiredPosition","summary","githubUrl","linkedinUrl","portfolioUrl","skills","experiences","educations","projects","certifications","languages","awards","activities","extraSections"))
    ((tools.jackson.databind.node.ObjectNode)resumeContent).set(field,parsed.path(field));
  }
  var jobSnapshot=snapshot(j);
  String contextHash=assessmentContexts.jobHash(mapper.valueToTree(jobSnapshot));
  jdbc.update("insert into recruitment.applications(id,job_id,candidate_id,resume_id,status,cover_letter,job_version,job_snapshot,ai_job_context_hash,version,applied_at,updated_at,submission_format,source_document_id) values(?,?,?,?,'SUBMITTED',?,?,?::jsonb,?,0,?,?,?,?)",
   id,j.getId(),u.getId(),r.getId(),letter,j.getVersion(),mapper.writeValueAsString(jobSnapshot),contextHash,Timestamp.from(now),Timestamp.from(now),format,document);
  jdbc.update("insert into recruitment.application_resume_snapshots(application_id,source_resume_version,schema_version,content,captured_at) values(?,?,1,?::jsonb,?)",
   id,r.getVersion(),mapper.writeValueAsString(resumeContent),Timestamp.from(now));
  jdbc.update("insert into recruitment.application_status_history(id,application_id,to_status,changed_by,created_at) values(?,?,'SUBMITTED',?,?)",UUID.randomUUID(),id,u.getId(),Timestamp.from(now));
  aiTasks.enqueue(id);
  return detail(auth,false,id);
 }
 private RecruiterJobDto snapshot(Job j) {
  var ss=skills.findForJobs(List.of(j.getId())).stream().map(s->new RecruiterJobDto.SkillDto(s.getSkill().getId(),s.getSkill().getName(),s.isRequired())).toList();
  var cs=criteria.findByJobIdOrderBySortOrderAscIdAsc(j.getId()).stream().map(c->new RecruiterJobDto.CriterionDto(c.getId(),c.getType(),c.getDescription(),c.isRequired(),c.getWeight(),c.getSortOrder())).toList();
  return new RecruiterJobDto(j.getId(),j.getDepartment().getId(),j.getDepartment().getName(),j.getPosition()==null?null:j.getPosition().getId(),j.getPosition()==null?null:j.getPosition().getName(),j.getTitle(),j.getHeadcount(),j.getDescription(),j.getRequirements(),j.getBenefits(),j.getLocation(),j.getEmploymentType(),j.getWorkMode(),j.getExperienceLevel(),j.getSalaryMin(),j.getSalaryMax(),j.getCurrency(),j.getStatus(),j.getPublishedAt(),j.getApplicationDeadline(),j.getCreatedAt(),j.getUpdatedAt(),j.getVersion(),ss,cs,List.of());
 }
 public ApplicationDto detail(Authentication auth,boolean staff,UUID id) {
  User u=actor(auth,staff);
  var args=new ArrayList<Object>();args.add(id);if(!staff)args.add(u.getId());
  var results=jdbc.query("select a.*,s.content::text as resume_content from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id where a.id=?"+(staff?"":" and a.candidate_id=?"),
   (rs,n)->new ApplicationDto(rs.getObject("id",UUID.class),rs.getObject("job_id",UUID.class),rs.getObject("candidate_id",UUID.class),rs.getObject("resume_id",UUID.class),rs.getString("status"),rs.getString("cover_letter"),rs.getLong("job_version"),rs.getLong("version"),rs.getTimestamp("applied_at").toInstant(),rs.getTimestamp("updated_at").toInstant(),mapper.readValue(rs.getString("job_snapshot"),RecruiterJobDto.class),mapper.readValue(rs.getString("resume_content"),ResumeDto.class),history(id),rs.getString("submission_format"),rs.getObject("source_document_id",UUID.class)),args.toArray());
  return results.stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn ứng tuyển."));
 }
 private List<ApplicationDto.HistoryDto> history(UUID id) {
  // Candidate/public detail exposes only status and time, never internal reasons or HR identity.
  return jdbc.query("select id,from_status,to_status,created_at from recruitment.application_status_history where application_id=? order by created_at,id",
   (r,n)->new ApplicationDto.HistoryDto(r.getObject("id",UUID.class),r.getString("from_status"),r.getString("to_status"),r.getTimestamp("created_at").toInstant()),id);
 }
 private static List<String> nextStages(String stage) {
  return switch(stage) {
   case "SUBMITTED" -> List.of("REVIEWING", "REJECTED");
   case "REVIEWING" -> List.of("INTERVIEW", "REJECTED");
   case "INTERVIEW" -> List.of("OFFER", "REJECTED");
   case "OFFER" -> List.of("HIRED", "REJECTED");
   default -> List.of();
  };
 }
 @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public ApplicationReviewDto review(Authentication auth, UUID id) {
  actor(auth,true);
  var application=detail(auth,true,id);
  var notes=jdbc.query("select id,body,author_id,author_name,created_at from recruitment.application_notes where application_id=? order by created_at desc,id desc",
   (r,n)->new ApplicationReviewDto.NoteDto(r.getObject("id",UUID.class),r.getString("body"),r.getObject("author_id",UUID.class),r.getString("author_name"),r.getTimestamp("created_at").toInstant()),id);
  var events=jdbc.query("select h.id,h.from_status,h.to_status,h.changed_by,coalesce(h.actor_name,u.full_name) as actor_name,h.reason,h.created_at from recruitment.application_status_history h join auth.users u on u.id=h.changed_by where h.application_id=? order by h.created_at,h.id",
   (r,n)->new ApplicationReviewDto.HistoryDto(r.getObject("id",UUID.class),r.getString("from_status"),r.getString("to_status"),r.getObject("changed_by",UUID.class),r.getString("actor_name"),r.getString("reason"),r.getTimestamp("created_at").toInstant()),id);
  return new ApplicationReviewDto(application,notes,events,nextStages(application.status()));
 }
 private record LockedApplication(String status,long version) {}
 private LockedApplication lockApplication(UUID id) {
  return jdbc.query("select status,version from recruitment.applications where id=? for update",
   (r,n)->new LockedApplication(r.getString("status"),r.getLong("version")),id).stream().findFirst()
   .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy đơn ứng tuyển."));
 }
 @Transactional
 public ApplicationReviewDto addNote(Authentication auth,UUID id,AddApplicationNoteRequest input) {
  User u=actor(auth,true);
  lockApplication(id);
  String body=input.body().strip();
  if(body.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ghi chú không được để trống.");
  var existing=jdbc.query("select author_id,body from recruitment.application_notes where application_id=? and request_id=?",
   (r,n)->Map.entry(r.getObject("author_id",UUID.class),r.getString("body")),id,input.requestId());
  if(!existing.isEmpty()) {
   if(!existing.getFirst().getKey().equals(u.getId()) || !existing.getFirst().getValue().equals(body))
    throw conflict("Yêu cầu ghi chú đã được dùng. Hãy gửi lại với nội dung mới.");
  } else {
   jdbc.update("insert into recruitment.application_notes(id,application_id,author_id,author_name,body,request_id,created_at) values(?,?,?,?,?,?,?)",
    UUID.randomUUID(),id,u.getId(),u.getFullName(),body,input.requestId(),Timestamp.from(Instant.now()));
  }
  return review(auth,id);
 }
 @Transactional
 public ApplicationReviewDto changeStatus(Authentication auth,UUID id,ChangeApplicationStatusRequest input) {
  User u=actor(auth,true);
  var current=lockApplication(id);
  if(current.version()!=input.version()) throw conflict("Hồ sơ vừa được người khác cập nhật. Hãy tải lại trước khi chuyển vòng.");
  if(!nextStages(current.status()).contains(input.status())) throw conflict("Không thể chuyển từ vòng hiện tại sang vòng đã chọn.");
  String reason=input.reason()==null || input.reason().isBlank()?null:input.reason().strip();
  if("REJECTED".equals(input.status()) && reason==null)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cần ghi lý do loại hồ sơ.");
  Instant now=Instant.now();
  jdbc.update("update recruitment.applications set status=?,version=version+1,updated_at=? where id=?",input.status(),Timestamp.from(now),id);
  jdbc.update("insert into recruitment.application_status_history(id,application_id,from_status,to_status,changed_by,actor_name,reason,created_at) values(?,?,?,?,?,?,?,?)",
   UUID.randomUUID(),id,current.status(),input.status(),u.getId(),u.getFullName(),reason,Timestamp.from(now));
  return review(auth,id);
 }
 @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public ApplicationDto.PageDto list(Authentication auth,boolean staff,UUID jobId,String stage,String search,int page,int size) {
  User u=actor(auth,staff);
  if(page<0 || page>100000 || size<1 || size>100 || search.length()>200 || (!stage.isEmpty()&&!STAGES.contains(stage)))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Bộ lọc hồ sơ không hợp lệ.");
  var args=new ArrayList<Object>();String where=" where true";
  if(!staff){where+=" and a.candidate_id=?";args.add(u.getId());}
  if(jobId!=null){where+=" and a.job_id=?";args.add(jobId);}
  if(!stage.isEmpty()){where+=" and a.status=?";args.add(stage);}
  if(!search.isBlank()) {
   where+=" and (strpos(lower(s.content->>'fullName'),?)>0 or strpos(lower(s.content->>'email'),?)>0 or strpos(lower(a.job_snapshot->>'title'),?)>0)";
   String term=search.trim().toLowerCase(Locale.ROOT);args.add(term);args.add(term);args.add(term);
  }
  String from=" from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id";
  long total=Objects.requireNonNull(jdbc.queryForObject("select count(*)"+from+where,Long.class,args.toArray()));
  args.add(size);args.add((long)page*size);
  String aiJoin=staff?" left join lateral (select score,summary,created_at from recruitment.ai_assessments where application_id=a.id order by created_at desc,id desc limit 1) ai on true":"";
  String aiColumns=staff?",ai.score as ai_score,ai.summary as ai_summary,ai.created_at as assessed_at":",null::integer as ai_score,null::text as ai_summary,null::timestamptz as assessed_at";
  var content=jdbc.query("select a.id,a.job_id,a.job_snapshot->>'title' as job_title,s.content->>'fullName' as name,s.content->>'email' as email,s.content->>'title' as resume_title,a.status,a.applied_at"+aiColumns+from+aiJoin+where+" order by a.applied_at desc,a.id limit ? offset ?",
   (r,n)->applicationItem(r),args.toArray());
  return new ApplicationDto.PageDto(content,page,size,total,(int)((total+size-1)/size));
 }
 @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 public ApplicationDto.Summary summary(Authentication auth,UUID jobId) {
  actor(auth,true);
  String where=jobId==null?"":" where job_id=?";Object[] args=jobId==null?new Object[]{}:new Object[]{jobId};
  Map<String,Long> counts=new LinkedHashMap<>();STAGES.forEach(s->counts.put(s,0L));
  jdbc.query("select status,count(*) as total from recruitment.applications"+where+" group by status",r->{counts.put(r.getString("status"),r.getLong("total"));},args);
  var jobCounts=jdbc.query("select a.job_id,j.title,count(*) as total from recruitment.applications a join recruitment.jobs j on j.id=a.job_id"+(jobId==null?"":" where a.job_id=?")+" group by a.job_id,j.title order by j.title,a.job_id",
   (r,n)->new ApplicationDto.JobCount(r.getObject("job_id",UUID.class),r.getString("title"),r.getLong("total")),args);
  long assessed=Objects.requireNonNull(jdbc.queryForObject("select count(*) from recruitment.applications"+where+(jobId==null?" where ":" and ")+"exists(select 1 from recruitment.ai_assessments ai where ai.application_id=applications.id)",Long.class,args));
  var priority=jdbc.query("select a.id,a.job_id,a.job_snapshot->>'title' as job_title,s.content->>'fullName' as name,s.content->>'email' as email,s.content->>'title' as resume_title,a.status,a.applied_at,ai.score as ai_score,ai.summary as ai_summary,ai.created_at as assessed_at from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id join lateral (select score,summary,created_at from recruitment.ai_assessments where application_id=a.id order by created_at desc,id desc limit 1) ai on true where a.status in ('SUBMITTED','REVIEWING','INTERVIEW')"+(jobId==null?"":" and a.job_id=?")+" order by ai.score desc,a.applied_at,a.id limit 5",(r,n)->applicationItem(r),args);
  return new ApplicationDto.Summary(counts.values().stream().mapToLong(Long::longValue).sum(),counts,jobCounts,assessed,priority);
 }
 private ApplicationDto.Item applicationItem(ResultSet r) throws SQLException {
  var assessed=r.getTimestamp("assessed_at");
  return new ApplicationDto.Item(r.getObject("id",UUID.class),r.getObject("job_id",UUID.class),r.getString("job_title"),r.getString("name"),r.getString("email"),r.getString("resume_title"),r.getString("status"),r.getTimestamp("applied_at").toInstant(),r.getObject("ai_score",Integer.class),r.getString("ai_summary"),assessed==null?null:assessed.toInstant());
 }

}
