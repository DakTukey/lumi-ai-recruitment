package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.AiAssessmentDto;
import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.TopCandidateDto;
import com.lumi.recruitment.service.AiAssessmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recruiter/applications")
public class AiAssessmentController {
    public record AnalyzeRequest(Boolean force) {}

    private final AiAssessmentService service;

    /**
     * Lấy assessment mới nhất. Trả về null nếu chưa phân tích.
     * GET /api/recruiter/applications/{id}/assessment
     */
    @GetMapping("/{id}/assessment")
    public ApiResponse<AiAssessmentDto> get(Authentication auth, @PathVariable UUID id) {
        var result = service.getLatest(auth, id);
        if (result == null)
            return ApiResponse.ok("Chưa có kết quả đánh giá AI.", null);
        return ApiResponse.ok("Kết quả đánh giá AI.", result);
    }

    /**
     * Trigger phân tích AI. Nếu đã có kết quả trong 24h → trả về cái cũ.
     * POST /api/recruiter/applications/{id}/assessment
     */
    @PostMapping("/{id}/assessment")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AiAssessmentDto> analyze(Authentication auth, @PathVariable UUID id,
            @RequestBody(required=false) AnalyzeRequest request) {
        return ApiResponse.ok("Đã phân tích hồ sơ bằng AI.", service.analyze(auth, id, request != null && Boolean.TRUE.equals(request.force())));
    }

    /**
     * Top N ứng viên điểm AI cao nhất cho một job cụ thể.
     * Chỉ trả về ứng viên đã được AI đánh giá, chưa bị loại/rút.
     *
     * GET /api/recruiter/applications/top?jobId={jobId}&limit=5
     */
    @GetMapping("/top")
    public ApiResponse<List<TopCandidateDto>> topCandidates(
            Authentication auth,
            @RequestParam UUID jobId,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.ok("Top ứng viên tiềm năng.", service.getTopCandidates(auth, jobId, limit));
    }
}
