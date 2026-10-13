package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class RecruiterProfileService {
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    private User staff(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Phiên đăng nhập không còn hợp lệ.");
        var user=users.findByEmail(auth.getName()).filter(u->u.getStatus()==UserStatus.ACTIVE)
            .orElseThrow(()->new BadCredentialsException("Phiên đăng nhập không còn hợp lệ."));
        if (user.getRole()!=UserRole.RECRUITER && user.getRole()!=UserRole.COMPANY_ADMIN)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Chỉ dành cho nhân sự tuyển dụng.");
        return user;
    }

    @Transactional(readOnly=true)
    public RecruiterProfileDto get(Authentication auth) { return dto(staff(auth)); }

    @Transactional
    public RecruiterProfileDto save(Authentication auth, RecruiterProfileRequest input) {
        var user=staff(auth);
        String phone=clean(input.phone()), code=clean(input.employeeCode()),
            title=clean(input.jobTitle()), avatar=clean(input.avatarUrl());
        if (phone!=null && (!phone.matches("\\+?[0-9\\s().-]+")
                || !phone.replaceAll("[^0-9]", "").matches("[0-9]{7,15}")))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Số điện thoại cần 7–15 chữ số, có thể có + và dấu phân cách.");
        if (avatar!=null) {
            try {
                var uri=new URI(avatar);
                if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                        || uri.getHost()==null || uri.getUserInfo()!=null)
                    throw new IllegalArgumentException();
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Đường dẫn ảnh cần là URL http/https hợp lệ, không chứa tài khoản hoặc mật khẩu.");
            }
        }
        var current=dto(user);
        if (input.departmentId()!=null) {
            var active=jdbc.query("select is_active from recruitment.departments where id=? for share",
                (r,n)->r.getBoolean(1),input.departmentId());
            if (active.isEmpty() || (!active.getFirst() && !input.departmentId().equals(current.departmentId())))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Phòng ban không tồn tại hoặc đã ngừng hoạt động.");
        }
        // Staff accounts created after V7 may not yet have a profile. Read remains side-effect free.
        jdbc.update("insert into recruitment.recruiter_profiles(user_id) values(?) on conflict(user_id) do nothing",user.getId());
        try {
            int changed=jdbc.update("""
                update recruitment.recruiter_profiles set phone=?, employee_code=?, job_title=?,
                    department_id=?, avatar_url=?, version=version+1 where user_id=? and version=?
                """,phone,code,title,input.departmentId(),avatar,user.getId(),input.version());
            if (changed!=1) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Hồ sơ đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu.");
        } catch (DataIntegrityViolationException e) {
            if (e.getMostSpecificCause() instanceof java.sql.SQLException sql && "23505".equals(sql.getSQLState()))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Mã nhân viên đã được sử dụng. Vui lòng chọn mã khác.");
            throw e;
        }
        return dto(user);
    }

    private String clean(String s) { return s==null || s.isBlank()?null:s.strip(); }
    private RecruiterProfileDto dto(User user) {
        return jdbc.query("""
            select p.*, d.name department_name, coalesce(d.is_active,false) department_active
            from recruitment.recruiter_profiles p left join recruitment.departments d on d.id=p.department_id
            where p.user_id=?
            """,(r,n)->new RecruiterProfileDto(user.getId(),user.getFullName(),user.getEmail(),user.getRole().name(),
                r.getString("phone"),r.getString("employee_code"),r.getString("job_title"),r.getObject("department_id",UUID.class),
                r.getString("department_name"),r.getBoolean("department_active"),r.getString("avatar_url"),r.getLong("version"),
                r.getTimestamp("created_at").toInstant(),r.getTimestamp("updated_at").toInstant()),user.getId())
            .stream().findFirst().orElseGet(()->new RecruiterProfileDto(user.getId(),user.getFullName(),user.getEmail(),
                user.getRole().name(),null,null,null,null,null,false,null,0,null,null));
    }
}
