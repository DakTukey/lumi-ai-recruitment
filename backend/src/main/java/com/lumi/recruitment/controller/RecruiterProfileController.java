package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.RecruiterProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/recruiter/profile")
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class RecruiterProfileController {
    private final RecruiterProfileService service;

    @GetMapping
    public ApiResponse<RecruiterProfileDto> get(Authentication auth) {
        return ApiResponse.ok("Hồ sơ nhân sự của bạn.", service.get(auth));
    }

    @PutMapping
    public ApiResponse<RecruiterProfileDto> save(Authentication auth,
            @Valid @RequestBody RecruiterProfileRequest request) {
        return ApiResponse.ok("Đã lưu hồ sơ nhân sự.", service.save(auth, request));
    }
}
