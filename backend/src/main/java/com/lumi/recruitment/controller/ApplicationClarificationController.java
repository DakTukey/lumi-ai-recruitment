package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.ApplicationClarificationService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController @RequiredArgsConstructor
public class ApplicationClarificationController {
    private final ApplicationClarificationService service;
    @GetMapping("/api/candidate/applications/{id}/clarifications")
    public ApiResponse<ApplicationClarificationDto> candidate(Authentication auth, @PathVariable UUID id, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok("Thông tin bổ sung.", service.get(auth,id,false));
    }
    @GetMapping("/api/recruiter/applications/{id}/clarifications")
    public ApiResponse<ApplicationClarificationDto> staff(Authentication auth, @PathVariable UUID id, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok("Thông tin ứng viên tự cung cấp.", service.get(auth,id,true));
    }
    @PostMapping("/api/candidate/applications/{id}/clarifications/generate")
    public ApiResponse<ApplicationClarificationDto> generate(Authentication auth, @PathVariable UUID id, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.ok("Trạng thái câu hỏi bổ sung.", service.generate(auth,id));
    }
    @PutMapping("/api/candidate/applications/{id}/clarifications/{questionId}")
    public ApiResponse<ApplicationClarificationDto> answer(Authentication auth, @PathVariable UUID id,
            @PathVariable UUID questionId, @Valid @RequestBody ApplicationClarificationDto.Answer input) {
        return ApiResponse.ok("Đã lưu lựa chọn của bạn.", service.answer(auth,id,questionId,input));
    }
}
