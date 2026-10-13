package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.*;
import com.lumi.recruitment.entity.recruitment.JobHistoryAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/recruiter")
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class RecruiterJobController {
    private final RecruiterJobService service;
    @GetMapping("/positions")
    public ApiResponse<List<RecruiterJobService.PositionDto>> positions(Authentication auth, @RequestParam UUID departmentId) {
        return ApiResponse.ok("Vị trí theo phòng ban.", service.positions(auth, departmentId));
    }
    public record DepartmentRequest(@NotBlank @Size(max=150) String name) {}
    @PostMapping("/departments") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JobService.DepartmentDto> createDepartment(Authentication auth,
            @Valid @RequestBody DepartmentRequest input) {
        return ApiResponse.ok("Đã tạo phòng ban.", service.createDepartment(auth, input.name()));
    }
    @PostMapping("/jobs") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RecruiterJobDto> create(Authentication auth, @Valid @RequestBody CreateJobRequest input) {
        return ApiResponse.ok("Đã lưu bản nháp tuyển dụng.", service.create(auth, input));
    }
    @PutMapping("/jobs/{id}")
    public ApiResponse<RecruiterJobDto> update(Authentication auth, @PathVariable UUID id,
            @Valid @RequestBody UpdateJobRequest input) {
        return ApiResponse.ok("Đã lưu thay đổi.", service.update(auth, id, input));
    }
    @PostMapping("/jobs/{id}/publish")
    public ApiResponse<RecruiterJobDto> publish(Authentication auth, @PathVariable UUID id,
            @Valid @RequestBody JobActionRequest input) {
        return ApiResponse.ok("Đã đăng tin tuyển dụng.", service.transition(auth, id, input.version(), JobHistoryAction.PUBLISHED));
    }
    @PostMapping("/jobs/{id}/close")
    public ApiResponse<RecruiterJobDto> close(Authentication auth, @PathVariable UUID id,
            @Valid @RequestBody JobActionRequest input) {
        return ApiResponse.ok("Đã đóng tin tuyển dụng.", service.transition(auth, id, input.version(), JobHistoryAction.CLOSED));
    }
    @PostMapping("/jobs/{id}/reopen")
    public ApiResponse<RecruiterJobDto> reopen(Authentication auth, @PathVariable UUID id,
            @Valid @RequestBody JobActionRequest input) {
        return ApiResponse.ok("Đã mở lại tin tuyển dụng.", service.transition(auth, id, input.version(), JobHistoryAction.REOPENED));
    }
    @GetMapping("/jobs")
    public ApiResponse<RecruiterJobDto.PageDto> list(Authentication auth,
            @RequestParam(defaultValue="") String keyword, @RequestParam(required=false) UUID departmentId,
            @RequestParam(defaultValue="") String status, @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="8") int size) {
        return ApiResponse.ok("Tin tuyển dụng của Lumi Studio.", service.list(auth, keyword, departmentId, status, page, size));
    }
    @GetMapping("/jobs/{id}")
    public ApiResponse<RecruiterJobDto> detail(Authentication auth, @PathVariable UUID id) {
        return ApiResponse.ok("Nội dung tin tuyển dụng.", service.detail(auth, id));
    }
}
