package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.GenerateJobDraftRequest;
import com.lumi.recruitment.dto.ParsedJobDraftDto;
import com.lumi.recruitment.service.RecruiterJobAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recruiter/jobs")
public class RecruiterJobAiController {
    private final RecruiterJobAiService service;

    @PostMapping(value = "/ai-parse-jd", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ParsedJobDraftDto>> parseJd(
            Authentication auth,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "text", required = false) String text) {
        ParsedJobDraftDto result = service.parseJd(auth, file, text);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Đã phân tích nội dung JD bằng AI thành công.", result));
    }

    @PostMapping("/ai-generate-jd")
    public ResponseEntity<ApiResponse<ParsedJobDraftDto>> generateJd(
            Authentication auth,
            @RequestBody GenerateJobDraftRequest request) {
        ParsedJobDraftDto result = service.generateJd(auth, request);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Đã soạn thảo nội dung tin tuyển dụng bằng AI thành công.", result));
    }
}
