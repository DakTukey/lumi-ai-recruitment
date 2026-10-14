package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.GenerateEmailRequest;
import com.lumi.recruitment.dto.GeneratedEmailDto;
import com.lumi.recruitment.entity.auth.User;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecruiterEmailAiService {

    private final UserRepository users;
    private final ApplicationService applicationService;
    private final AiServiceClient aiServiceClient;

    private User checkRecruiter(Authentication auth) {
        if (auth == null) {
            throw new BadCredentialsException("Vui lòng đăng nhập để tiếp tục.");
        }
        User u = users.findByEmail(auth.getName())
                .filter(v -> v.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Tài khoản không hợp lệ."));
        if (u.getRole() != UserRole.RECRUITER && u.getRole() != UserRole.COMPANY_ADMIN) {
            throw new AccessDeniedException("Chỉ nhà tuyển dụng hoặc quản trị viên mới có quyền thực hiện thao tác này.");
        }
        return u;
    }

    public GeneratedEmailDto generateEmail(Authentication auth, UUID applicationId, GenerateEmailRequest req) {
        checkRecruiter(auth);

        var application = applicationService.detail(auth, true, applicationId);
        if (application == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy hồ sơ ứng tuyển.");
        }

        String candidateName = application.resumeSnapshot() != null ? application.resumeSnapshot().fullName() : "Ứng viên";
        String candidateEmail = application.resumeSnapshot() != null ? application.resumeSnapshot().email() : "";
        String jobTitle = application.jobSnapshot() != null ? application.jobSnapshot().title() : "Vị trí tuyển dụng";
        String companyName = "Lumi Studio";

        Map<String, Object> payload = new HashMap<>();
        payload.put("template_type", req.templateType() != null && !req.templateType().isBlank() ? req.templateType() : "INTERVIEW");
        payload.put("candidate_name", candidateName);
        payload.put("candidate_email", candidateEmail);
        payload.put("job_title", jobTitle);
        payload.put("company_name", companyName);
        payload.put("interview_time", req.interviewTime() != null ? req.interviewTime() : "");
        payload.put("interview_format", req.interviewFormat() != null ? req.interviewFormat() : "");
        payload.put("interview_location", req.interviewLocation() != null ? req.interviewLocation() : "");
        payload.put("salary_offer", req.salaryOffer() != null ? req.salaryOffer() : "");
        payload.put("start_date", req.startDate() != null ? req.startDate() : "");
        payload.put("rejection_reason", req.rejectionReason() != null ? req.rejectionReason() : "");
        payload.put("additional_notes", req.additionalNotes() != null ? req.additionalNotes() : "");
        payload.put("tone", req.tone() != null && !req.tone().isBlank() ? req.tone() : "professional");

        var result = aiServiceClient.generateRecruitmentEmail(payload);
        return new GeneratedEmailDto(
            result.subject(),
            result.body(),
            candidateName,
            candidateEmail,
            jobTitle
        );
    }
}
