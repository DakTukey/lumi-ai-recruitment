package com.lumi.recruitment.controller;
import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.CandidateBenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import java.util.UUID;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/candidate/jobs/{jobId}/benchmark")
public class CandidateBenchmarkController {
    private final CandidateBenchmarkService service;
    @GetMapping public ApiResponse<CandidateBenchmarkDto> compare(Authentication auth,@PathVariable UUID jobId,@RequestParam UUID resumeId,jakarta.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control","no-store");
        return ApiResponse.ok("So sánh CV với mặt bằng hồ sơ đã phân tích.",service.compare(auth,jobId,resumeId));
    }
}
