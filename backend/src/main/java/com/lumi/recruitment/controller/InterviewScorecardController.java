package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.InterviewScorecardDto;
import com.lumi.recruitment.service.InterviewScorecardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recruiter/applications")
public class InterviewScorecardController {
    public record GenerateRequest(Boolean force) {}

    private final InterviewScorecardService service;

    @GetMapping("/{id}/scorecard")
    public ApiResponse<InterviewScorecardDto> get(Authentication auth, @PathVariable UUID id,jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        var result = service.get(auth, id);
        if (result == null) {
            return ApiResponse.ok("Chưa có phiếu phỏng vấn.", null);
        }
        return ApiResponse.ok("Phiếu phỏng vấn ứng viên.", result);
    }

    @PostMapping("/{id}/scorecard/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<InterviewScorecardDto> generate(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody(required = false) GenerateRequest request) {
        boolean force = request != null && Boolean.TRUE.equals(request.force());
        var result = service.generate(auth, id, force);
        return ApiResponse.ok("Đã tạo phiếu phỏng vấn AI.", result);
    }

    @PutMapping("/{id}/scorecard")
    public ApiResponse<InterviewScorecardDto> save(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody InterviewScorecardDto.SaveRequest request) {
        var result = service.save(auth, id, request);
        return ApiResponse.ok("Đã cập nhật phiếu phỏng vấn.", result);
    }
}

