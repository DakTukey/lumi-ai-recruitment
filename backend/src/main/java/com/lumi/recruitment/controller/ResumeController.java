package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.ResumeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/candidate/resumes")
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class ResumeController {
    private final ResumeService service;
    private final com.lumi.recruitment.service.CvBuilderPolicy builderPolicy;
    public record VersionRequest(@NotNull @PositiveOrZero Long version) {}
    @GetMapping("/position-options")
    public ApiResponse<List<String>> positionOptions() {
        return ApiResponse.ok("Gợi ý vị trí trong công ty.", service.positionOptions());
    }
    @GetMapping("/skill-options")
    public ApiResponse<List<String>> skillOptions() {
        return ApiResponse.ok("Gợi ý kỹ năng trong hệ thống.", service.skillOptions());
    }
    @GetMapping("/university-options")
    public ApiResponse<List<UniversityOptionDto>> universityOptions() {
        return ApiResponse.ok("Gợi ý trường đại học.", service.universityOptions());
    }
    @GetMapping public ApiResponse<List<ResumeDto>> list(Authentication auth) { return ApiResponse.ok("CV của bạn.", service.list(auth)); }
    @GetMapping("/{id}") public ApiResponse<ResumeDto> get(Authentication auth, @PathVariable UUID id) { return ApiResponse.ok("Nội dung CV.", service.get(auth, id)); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResumeDto> create(Authentication auth, @Valid @RequestBody ResumeRequest body) { builderPolicy.requireEnabled(); return ApiResponse.ok("Đã tạo CV.", service.save(auth, null, body)); }
    @PutMapping("/{id}")
    public ApiResponse<ResumeDto> update(Authentication auth, @PathVariable UUID id, @Valid @RequestBody ResumeRequest body) { builderPolicy.requireEnabled(); return ApiResponse.ok("Đã lưu CV.", service.save(auth, id, body)); }
    @PutMapping("/{id}/default")
    public ApiResponse<ResumeDto> makeDefault(Authentication auth, @PathVariable UUID id, @Valid @RequestBody VersionRequest body) { builderPolicy.requireEnabled(); return ApiResponse.ok("Đã đặt CV mặc định.", service.makeDefault(auth, id, body.version())); }
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(Authentication auth, @PathVariable UUID id, @RequestParam long version) { builderPolicy.requireEnabled(); service.delete(auth, id, version); return ApiResponse.ok("Đã xóa CV.", null); }
}
