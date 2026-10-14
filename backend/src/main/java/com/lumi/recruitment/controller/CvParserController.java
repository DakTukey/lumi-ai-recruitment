package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.ParsedResumeDto;
import com.lumi.recruitment.service.CvParserService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/candidate/cv-parser")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class CvParserController {
    private final CvParserService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<ParsedResumeDto>> parse(
            Authentication auth,
            @RequestParam("file") MultipartFile file) {
        var result = service.parsePdf(auth, file);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(ApiResponse.ok("Đã bóc tách thành công CV từ tệp.", result));
    }
}
