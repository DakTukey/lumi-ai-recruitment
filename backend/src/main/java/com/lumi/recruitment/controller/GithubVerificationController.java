package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.GithubVerificationDto;
import com.lumi.recruitment.service.GithubVerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recruiter/applications")
public class GithubVerificationController {
    private final GithubVerificationService service;

    @GetMapping("/{id}/github-source")
    public ApiResponse<GithubVerificationService.GithubSource> source(Authentication auth,@PathVariable UUID id,jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok("Nguồn GitHub từ CV đã nộp.",service.source(auth,id));
    }

    @GetMapping("/{id}/github-verification")
    public ApiResponse<GithubVerificationDto> get(Authentication auth, @PathVariable UUID id) {
        var result = service.get(auth, id);
        if (result == null) {
            return ApiResponse.ok("Chưa có kết quả đối chiếu GitHub.", null);
        }
        return ApiResponse.ok("Kết quả đối chiếu GitHub.", result);
    }

    @PostMapping("/{id}/github-verification")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<GithubVerificationDto> verify(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody(required = false) GithubVerificationDto.Request request) {
        boolean force = request != null && Boolean.TRUE.equals(request.force());
        var result = service.verify(auth, id, force);
        return ApiResponse.ok("Đã đối chiếu thông tin với GitHub.", result);
    }
}

