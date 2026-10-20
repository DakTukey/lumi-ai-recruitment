package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.CandidateJobMatchDto;
import com.lumi.recruitment.service.CandidateJobMatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/candidate/jobs/{jobId}/match")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class CandidateJobMatchController {

    private final CandidateJobMatchService service;

    @GetMapping("/pdf")
    public ApiResponse<CandidateJobMatchDto> getPdf(jakarta.servlet.http.HttpServletResponse response,
            Authentication auth,@PathVariable UUID jobId,@RequestParam UUID documentId) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok("Kết quả đối chiếu PDF đã lưu.",service.getCachedPdfMatch(auth,jobId,documentId));
    }
    @PostMapping("/pdf")
    public ApiResponse<CandidateJobMatchDto> analyzePdf(jakarta.servlet.http.HttpServletResponse response,
            Authentication auth,@PathVariable UUID jobId,@Valid @RequestBody CandidateJobMatchDto.PdfMatchRequest request) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok("Đã đối chiếu CV PDF.",service.matchPdf(auth,jobId,request.documentId(),request.documentVersion(),request.force()));
    }

    @GetMapping
    public ApiResponse<CandidateJobMatchDto> getCached(
            jakarta.servlet.http.HttpServletResponse response,
            Authentication auth,
            @PathVariable UUID jobId,
            @RequestParam UUID resumeId) {
        response.setHeader("Cache-Control", "no-store");
        CandidateJobMatchDto cached = service.getCachedMatch(auth, jobId, resumeId);
        return ApiResponse.ok(cached != null ? "Kết quả đối chiếu đã lưu." : "Chưa có kết quả đối chiếu.", cached);
    }

    @PostMapping
    public ApiResponse<CandidateJobMatchDto> analyze(
            jakarta.servlet.http.HttpServletResponse response,
            Authentication auth,
            @PathVariable UUID jobId,
            @Valid @RequestBody CandidateJobMatchDto.MatchRequest request) {
        response.setHeader("Cache-Control", "no-store");
        CandidateJobMatchDto result = service.match(auth, jobId, request.resumeId(), request.force());
        return ApiResponse.ok("Phân tích mức độ phù hợp hoàn tất.", result);
    }
}
