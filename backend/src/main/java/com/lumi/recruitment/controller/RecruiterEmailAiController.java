package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.GenerateEmailRequest;
import com.lumi.recruitment.dto.GeneratedEmailDto;
import com.lumi.recruitment.service.RecruiterEmailAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recruiter/applications")
public class RecruiterEmailAiController {

    private final RecruiterEmailAiService service;

    @PostMapping("/{id}/ai-email")
    public ApiResponse<GeneratedEmailDto> generateEmail(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody(required = false) GenerateEmailRequest request) {
        var email = service.generateEmail(auth, id, request != null ? request : new GenerateEmailRequest("INTERVIEW", null, null, null, null, null, null, null, "professional"));
        return ApiResponse.ok("Đã soạn thảo email bằng AI thành công.", email);
    }
}
