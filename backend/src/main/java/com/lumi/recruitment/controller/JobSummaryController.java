package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.JobSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController @RequestMapping("/api/jobs/{id}/ai-summary") @RequiredArgsConstructor
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class JobSummaryController {
    private final JobSummaryService service;
    @GetMapping public ResponseEntity<ApiResponse<JobSummaryDto>> cached(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Tóm tắt tin tuyển dụng.", service.cached(id)));
    }
    @PostMapping public ResponseEntity<ApiResponse<JobSummaryDto>> generate(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Tóm tắt tin tuyển dụng.", service.generate(id)));
    }
}
