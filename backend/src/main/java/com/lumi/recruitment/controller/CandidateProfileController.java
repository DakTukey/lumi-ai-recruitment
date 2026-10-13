package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.CandidateProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/candidate")
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class CandidateProfileController {
    private final CandidateProfileService service;
    private final com.lumi.recruitment.service.CandidatePreferenceOptions options;

    @GetMapping("/profile/options")
    public ApiResponse<com.lumi.recruitment.service.CandidatePreferenceOptions.Options> options() {
        return ApiResponse.ok("Lựa chọn tìm việc tại Lumi.", options.get());
    }

    @GetMapping("/profile")
    public ApiResponse<CandidateProfileDto> get(Authentication auth) {
        return ApiResponse.ok("Hồ sơ ứng viên.", service.get(auth));
    }

    @PutMapping("/profile")
    public ApiResponse<CandidateProfileDto> save(Authentication auth, @Valid @RequestBody CandidateProfileRequest request) {
        return ApiResponse.ok("Đã lưu hồ sơ.", service.save(auth, request, null));
    }

    @PostMapping("/onboarding/steps/{step}")
    public ApiResponse<CandidateProfileDto> step(Authentication auth, @PathVariable int step,
            @Valid @RequestBody CandidateProfileRequest request) {
        return ApiResponse.ok("Đã lưu câu trả lời.", service.save(auth, request, step));
    }

    @PostMapping("/onboarding/skip")
    public ApiResponse<CandidateProfileDto> skip(Authentication auth) {
        return ApiResponse.ok("Bạn có thể bổ sung hồ sơ sau.", service.skip(auth));
    }
}
