package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.GenerateJobDraftRequest;
import com.lumi.recruitment.dto.ParsedJobDraftDto;
import com.lumi.recruitment.entity.auth.User;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.entity.recruitment.Department;
import com.lumi.recruitment.repository.DepartmentRepository;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecruiterJobAiService {
    private final UserRepository users;
    private final DepartmentRepository departments;
    private final AiServiceClient aiServiceClient;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private User requireRecruiter(Authentication auth) {
        if (auth == null) throw new BadCredentialsException("Vui lòng đăng nhập.");
        User u = users.findByEmail(auth.getName()).filter(user -> user.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (u.getRole() != UserRole.RECRUITER && u.getRole() != UserRole.COMPANY_ADMIN) {
            throw new AccessDeniedException("Chỉ dành cho nhà tuyển dụng hoặc quản trị viên.");
        }
        return u;
    }

    public ParsedJobDraftDto parseJd(Authentication auth, MultipartFile file, String text) {
        requireRecruiter(auth);

        byte[] bytes = null;
        String filename = null;
        if (file != null && !file.isEmpty()) {
            if (file.getSize() > MAX_FILE_SIZE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dung lượng tệp tối đa 10 MB.");
            }
            filename = file.getOriginalFilename();
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc dữ liệu tệp tải lên.");
            }
        }

        if ((bytes == null || bytes.length == 0) && (text == null || text.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn tệp JD hoặc dán nội dung văn bản.");
        }

        ParsedJobDraftDto result = aiServiceClient.parseJd(bytes, filename, text);
        return attachDepartmentId(result);
    }

    public ParsedJobDraftDto generateJd(Authentication auth, GenerateJobDraftRequest request) {
        requireRecruiter(auth);
        if (request == null || request.title() == null || request.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng cung cấp chức danh hoặc vị trí cần tuyển.");
        }

        ParsedJobDraftDto result = aiServiceClient.generateJd(request);
        return attachDepartmentId(result);
    }

    private ParsedJobDraftDto attachDepartmentId(ParsedJobDraftDto draft) {
        if (draft == null) return null;
        String deptId = null;
        String suggested = draft.suggestedDepartment();
        if (suggested != null && !suggested.isBlank()) {
            List<Department> activeDepts = departments.findByActiveTrueOrderByNameAsc();
            for (Department d : activeDepts) {
                if (d.getName().equalsIgnoreCase(suggested)
                    || d.getName().toLowerCase().contains(suggested.toLowerCase())
                    || suggested.toLowerCase().contains(d.getName().toLowerCase())) {
                    deptId = d.getId().toString();
                    break;
                }
            }
            if (deptId == null && !activeDepts.isEmpty()) {
                deptId = activeDepts.get(0).getId().toString();
            }
        }
        return new ParsedJobDraftDto(
            draft.title(),
            draft.category(),
            draft.headcount(),
            draft.location(),
            draft.level(),
            draft.mode(),
            draft.employmentType(),
            draft.salaryMode(),
            draft.salaryMin(),
            draft.salaryMax(),
            draft.deadline(),
            draft.description(),
            draft.requirements(),
            draft.benefits(),
            draft.skills(),
            draft.criteria(),
            draft.suggestedDepartment(),
            deptId
        );
    }
}
