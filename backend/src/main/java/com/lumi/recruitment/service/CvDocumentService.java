package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.ParsedResumeDto;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.security.MessageDigest;
import java.util.concurrent.Semaphore;

@Service @RequiredArgsConstructor
public class CvDocumentService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;
    private final CvReviewValidation reviewValidation;
    private final Semaphore slots = new Semaphore(2);
    public static final String VERSION="pdf-import-v3";
    public record Document(UUID id,String filename,String title,boolean isDefault,String status,ParsedResumeDto parsed,int attempts,Instant createdAt,ParsedResumeDto reviewed,long reviewVersion,Instant confirmedAt,List<CvReviewValidation.Issue> issues) {}
    private User actor(Authentication auth) {
        if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Hãy đăng nhập.");
        return users.findByEmail(auth.getName()).filter(u->u.getStatus()==UserStatus.ACTIVE)
            .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Phiên không còn hợp lệ."));
    }
    private User candidate(Authentication auth) {
        var u=actor(auth);
        if(u.getRole()!=UserRole.CANDIDATE) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho ứng viên.");
        return u;
    }
    private ResponseStatusException missing() {return new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy PDF của bạn.");}
    @org.springframework.transaction.annotation.Transactional
    public Document upload(Authentication auth,MultipartFile file) {
        var u=candidate(auth);
        jdbc.queryForObject("select user_id from candidate.candidate_profiles where user_id=? for update",UUID.class,u.getId());
        if(file==null || file.isEmpty() || file.getSize()>10*1024*1024)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chọn PDF có nội dung, tối đa 10 MB.");
        try {
            var bytes=file.getBytes();
            if(bytes.length<5 || !new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nội dung tệp không phải PDF.");
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            String name=Objects.toString(file.getOriginalFilename(),"cv.pdf").replaceAll("[\\p{Cntrl}/\\\\]","_");
            if(!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chỉ hỗ trợ PDF.");
            if(name.length()>255) name=name.substring(0,251)+".pdf";
            // Bound private storage per account; a duplicate file does not consume another slot.
            var existing=jdbc.queryForList("select id from candidate.resume_documents where candidate_id=? and sha256=?",UUID.class,u.getId(),hash);
            if(!existing.isEmpty()) return get(auth,existing.getFirst());
            if(jdbc.queryForObject("select count(*) from candidate.resume_documents where candidate_id=?",Integer.class,u.getId())>=50)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Bạn đã có 50 PDF. Hãy dùng lại PDF đã tải.");
            jdbc.update("insert into candidate.resume_documents(candidate_id,filename,display_name,sha256,content) values(?,?,?,?,?) on conflict(candidate_id,sha256) do nothing",u.getId(),name,name.substring(0,Math.min(100,name.length())),hash,bytes);
            UUID id=jdbc.queryForObject("select id from candidate.resume_documents where candidate_id=? and sha256=?",UUID.class,u.getId(),hash);
            return get(auth,id);
        } catch(ResponseStatusException e) {throw e;}
        catch(Exception e) {throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chưa lưu được PDF. Hãy thử lại.");}
    }
    public List<Document> list(Authentication auth) {return documents(candidate(auth).getId(),null);}
    private List<Document> documents(UUID owner,UUID id) {
        return jdbc.query("select d.id,d.filename,d.display_name,(p.default_document_id=d.id),d.status,d.parsed_content::text,d.attempts,d.created_at,d.reviewed_content::text,d.review_version,d.confirmed_at from candidate.resume_documents d join candidate.candidate_profiles p on p.user_id=d.candidate_id where d.candidate_id=?"+(id==null?" order by d.created_at desc limit 50":" and d.id=?"),
            (rs,n)->{
                var parsed=rs.getString(6)==null?null:mapper.readValue(rs.getString(6),ParsedResumeDto.class);
                var reviewed=rs.getString(9)==null?null:mapper.readValue(rs.getString(9),ParsedResumeDto.class);
                var confirmed=rs.getTimestamp(11);
                return new Document(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getBoolean(4),rs.getString(5),parsed,rs.getInt(7),rs.getTimestamp(8).toInstant(),
                    reviewed,rs.getLong(10),confirmed==null?null:confirmed.toInstant(),reviewValidation.issues(reviewed==null?parsed:reviewed));
            },
            id==null?new Object[]{owner}:new Object[]{owner,id});
    }
    public Document get(Authentication auth,UUID id) {return documents(candidate(auth).getId(),id).stream().findFirst().orElseThrow(this::missing);}
    @org.springframework.transaction.annotation.Transactional
    public Document rename(Authentication auth,UUID id,String title) {
        var owner=candidate(auth);
        if(title==null || title.isBlank() || title.strip().length()>100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tên CV cần từ 1 đến 100 ký tự.");
        if(jdbc.update("update candidate.resume_documents set display_name=? where id=? and candidate_id=?",title.strip(),id,owner.getId())!=1) throw missing();
        return get(auth,id);
    }
    @org.springframework.transaction.annotation.Transactional
    public Document makeDefault(Authentication auth,UUID id) {
        var owner=candidate(auth);
        jdbc.queryForObject("select user_id from candidate.candidate_profiles where user_id=? for update",UUID.class,owner.getId());
        if(documents(owner.getId(),id).isEmpty()) throw missing();
        jdbc.update("update candidate.resumes set is_default=false,updated_at=now() where candidate_id=? and is_default=true",owner.getId());
        jdbc.update("update candidate.candidate_profiles set default_document_id=? where user_id=?",id,owner.getId());
        return get(auth,id);
    }
    public record ReviewRequest(ParsedResumeDto content,Long version,boolean confirm) {}
    @org.springframework.transaction.annotation.Transactional
    public Document review(Authentication auth,UUID id,ReviewRequest input) {
        var owner=candidate(auth);
        var original=get(auth,id);
        if(!"PARSED".equals(original.status()) || original.parsed()==null)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Hãy đọc PDF trước khi kiểm tra thông tin.");
        if(input.content()==null || input.version()==null || input.version()!=original.reviewVersion())
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Thông tin PDF vừa thay đổi. Hãy tải lại bản mới.");
        var data=mapper.valueToTree(input.content());
        if(data.toString().length()>300000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Nội dung CV quá dài.");
        // Evidence and machine warnings belong to the immutable extraction, never to client edits.
        var object=(tools.jackson.databind.node.ObjectNode)data;
        var machine=mapper.valueToTree(original.parsed());
        for(String field:List.of("sources","warnings","extractedText","pageCount")) object.set(field,machine.path(field));
        var checked=reviewValidation.normalizeLinks(mapper.treeToValue(object,ParsedResumeDto.class));
        var errors=reviewValidation.issues(checked).stream().filter(i->"ERROR".equals(i.severity())).toList();
        if(input.confirm() && !errors.isEmpty())
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Hãy sửa thông tin trước khi xác nhận: "+CvReviewValidation.label(errors.getFirst().path())+" — "+errors.getFirst().message());
        if(jdbc.update("update candidate.resume_documents set reviewed_content=?::jsonb,review_version=review_version+1,confirmed_at=? where id=? and candidate_id=? and review_version=? and status='PARSED'",
            mapper.writeValueAsString(checked),input.confirm()?java.sql.Timestamp.from(Instant.now()):null,id,owner.getId(),input.version())!=1)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Thông tin PDF vừa thay đổi. Hãy tải lại bản mới.");
        return get(auth,id);
    }
    public Document parse(Authentication auth,UUID id) {
        return parseOwned(candidate(auth).getId(),id);
    }
    // Used after an application has been accepted; parsing failures must not undo submission.
    @org.springframework.transaction.annotation.Transactional(propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW,noRollbackFor=RuntimeException.class)
    public ParsedResumeDto parseForAssessment(UUID candidateId,UUID documentId) {
        return parseOwned(candidateId,documentId).parsed();
    }
    private Document parseOwned(UUID owner,UUID id) {
        var doc=documents(owner,id).stream().findFirst().orElseThrow(this::missing);
        if("PARSED".equals(doc.status())) return doc;
        if(doc.attempts()>=3) {
            boolean active=Boolean.TRUE.equals(jdbc.queryForObject("select status='PROCESSING' and parse_started_at>now()-interval '10 minutes' from candidate.resume_documents where id=? and candidate_id=?",Boolean.class,id,owner));
            if(active) throw new ResponseStatusException(HttpStatus.CONFLICT,"PDF đang được đọc. Hãy chờ kết quả.");
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"PDF chưa đọc được sau 3 lần thử.");
        }
        if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau.");
        UUID token=UUID.randomUUID();boolean claimed=false;
        try {
            claimed=jdbc.update("""
                update candidate.resume_documents set status='PROCESSING',parse_token=?,parse_started_at=now(),attempts=attempts+1
                where id=? and candidate_id=? and attempts<3 and status<>'PARSED'
                and (status<>'PROCESSING' or parse_started_at is null or parse_started_at<now()-interval '10 minutes')
                """,token,id,owner)==1;
            if(!claimed) throw new ResponseStatusException(HttpStatus.CONFLICT,"PDF đang xử lý hoặc đã hết 3 lần thử. Hãy thử lại sau.");
            byte[] bytes=jdbc.queryForObject("select content from candidate.resume_documents where id=?",byte[].class,id);
            var result=ai.parseCv(bytes,"cv.pdf");
            jdbc.update("update candidate.resume_documents set status='PARSED',parsed_content=?::jsonb,parser_version=?,parse_token=null,parse_started_at=null where id=? and parse_token=?",mapper.writeValueAsString(result),VERSION,id,token);
            return documents(owner,id).stream().findFirst().orElseThrow(this::missing);
        } catch(RuntimeException e) {
            // An unavailable AI service says nothing about whether the PDF can be read.
            // Keep file failures bounded without exhausting retries during an outage.
            int refund=e instanceof ResponseStatusException failure && (failure.getStatusCode().is5xxServerError() || failure.getStatusCode().value()==429)?1:0;
            if(claimed) jdbc.update("update candidate.resume_documents set status='FAILED',attempts=greatest(attempts-?,0),parse_token=null,parse_started_at=null where id=? and parse_token=?",refund,id,token);
            throw e;
        } finally {slots.release();}
    }
    public byte[] ownFile(Authentication auth,UUID id) {
        var owner=candidate(auth);
        var files=jdbc.query("select content from candidate.resume_documents where id=? and candidate_id=?",(rs,n)->rs.getBytes(1),id,owner.getId());
        return files.stream().findFirst().orElseThrow(this::missing);
    }
    public byte[] applicationFile(Authentication auth,UUID application) {
        var u=actor(auth);
        if(u.getRole()!=UserRole.RECRUITER && u.getRole()!=UserRole.COMPANY_ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho nhân sự tuyển dụng.");
        var files=jdbc.query("select d.content from recruitment.applications a join candidate.resume_documents d on d.id=a.source_document_id where a.id=? and a.submission_format='ORIGINAL_PDF'",(rs,n)->rs.getBytes(1),application);
        return files.stream().findFirst().orElseThrow(this::missing);
    }
    public record Extraction(String status,ParsedResumeDto parsed,Instant confirmedAt,String analysisState) {}
    public Extraction applicationExtraction(Authentication auth,UUID application) {
        var u=actor(auth);
        if(u.getRole()!=UserRole.RECRUITER && u.getRole()!=UserRole.COMPANY_ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho nhân sự tuyển dụng.");
        var result=jdbc.query("""
            select d.status,d.parsed_content::text,s.content->>'pdfConfirmedAt',s.content->'pdfReviewedContent',coalesce(t.status,'NOT_REQUESTED')
            from recruitment.applications a join candidate.resume_documents d on d.id=a.source_document_id
            join recruitment.application_resume_snapshots s on s.application_id=a.id
            left join recruitment.ai_analysis_tasks t on t.application_id=a.id
            where a.id=? and a.submission_format='ORIGINAL_PDF'
            """,(rs,n)->{
                String confirmed=rs.getString(3),reviewed=rs.getString(4),raw=rs.getString(2);
                return new Extraction(confirmed==null?rs.getString(1):"PARSED",
                    reviewed!=null?mapper.readValue(reviewed,ParsedResumeDto.class):raw==null?null:mapper.readValue(raw,ParsedResumeDto.class),
                    confirmed==null?null:Instant.parse(confirmed),rs.getString(5));
            },application);
        return result.stream().findFirst().orElseThrow(this::missing);
    }
}
