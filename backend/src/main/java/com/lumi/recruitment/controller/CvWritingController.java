package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.CvWritingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/candidate/cv-writing")
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class CvWritingController {
    private final CvWritingService service;
    private final com.lumi.recruitment.service.CvBuilderPolicy builderPolicy;
    @PostMapping
    public ResponseEntity<ApiResponse<CvWritingDto.Result>> rewrite(Authentication auth, @Valid @RequestBody CvWritingDto.Request input) {
        builderPolicy.requireEnabled();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Đề xuất viết CV. Hãy kiểm tra trước khi áp dụng.", service.rewrite(auth, input)));
    }
}
