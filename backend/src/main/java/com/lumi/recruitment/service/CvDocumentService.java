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
    private final Semaphore slots = new Semaphore(2);
    public static final String VERSION="pdf-import-v2";
    public record Document(UUID id,String filename,String status,ParsedResumeDto parsed,int attempts,Instant createdAt) {}
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
            jdbc.update("insert into candidate.resume_documents(candidate_id,filename,sha256,content) values(?,?,?,?) on conflict(candidate_id,sha256) do nothing",u.getId(),name,hash,bytes);
            UUID id=jdbc.queryForObject("select id from candidate.resume_documents where candidate_id=? and sha256=?",UUID.class,u.getId(),hash);
            return get(auth,id);
        } catch(ResponseStatusException e) {throw e;}
        catch(Exception e) {throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Chưa lưu được PDF. Hãy thử lại.");}
    }
    public List<Document> list(Authentication auth) {return documents(candidate(auth).getId(),null);}
    private List<Document> documents(UUID owner,UUID id) {
        return jdbc.query("select id,filename,status,parsed_content::text,attempts,created_at from candidate.resume_documents where candidate_id=?"+(id==null?" order by created_at desc limit 50":" and id=?"),
            (rs,n)->new Document(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getString(4)==null?null:mapper.readValue(rs.getString(4),ParsedResumeDto.class),rs.getInt(5),rs.getTimestamp(6).toInstant()),
            id==null?new Object[]{owner}:new Object[]{owner,id});
    }
    public Document get(Authentication auth,UUID id) {return documents(candidate(auth).getId(),id).stream().findFirst().orElseThrow(this::missing);}
    public Document parse(Authentication auth,UUID id) {
        var owner=candidate(auth);var doc=get(auth,id);
        if("PARSED".equals(doc.status())) return doc;
        if(!slots.tryAcquire()) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"AI đang bận. Hãy thử lại sau.");
        UUID token=UUID.randomUUID();boolean claimed=false;
        try {
            claimed=jdbc.update("""
                update candidate.resume_documents set status='PROCESSING',parse_token=?,parse_started_at=now(),attempts=attempts+1
                where id=? and candidate_id=? and attempts<3 and status<>'PARSED'
                and (parse_started_at is null or parse_started_at<now()-interval '90 seconds')
                """,token,id,owner.getId())==1;
            if(!claimed) throw new ResponseStatusException(HttpStatus.CONFLICT,"PDF đang xử lý hoặc đã hết 3 lần thử. Nếu vừa gặp lỗi, hãy chờ 90 giây trước khi thử lại.");
            byte[] bytes=jdbc.queryForObject("select content from candidate.resume_documents where id=?",byte[].class,id);
            var result=ai.parseCv(bytes,"cv.pdf");
            jdbc.update("update candidate.resume_documents set status='PARSED',parsed_content=?::jsonb,parser_version=?,parse_token=null where id=? and parse_token=?",mapper.writeValueAsString(result),VERSION,id,token);
            return get(auth,id);
        } catch(RuntimeException e) {
            if(claimed) jdbc.update("update candidate.resume_documents set status='FAILED',parse_token=null where id=? and parse_token=?",id,token);
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
}
