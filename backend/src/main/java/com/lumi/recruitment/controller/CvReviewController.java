package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.CvReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/candidate/cv-review")
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class CvReviewController {
    private final CvReviewService service;
    @PostMapping public ResponseEntity<ApiResponse<CvReviewDto.Result>> review(Authentication auth, @Valid @RequestBody CvReviewDto.Request input) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok("Đã rà soát CV. Hãy kiểm tra từng đề xuất.", service.review(auth,input)));
    }
    @PostMapping("/refine") public ResponseEntity<ApiResponse<CvReviewDto.Refined>> refine(Authentication auth, @Valid @RequestBody CvReviewDto.RefineRequest input) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok("Đề xuất từ thông tin bạn cung cấp.", service.refine(auth,input)));
    }
}
