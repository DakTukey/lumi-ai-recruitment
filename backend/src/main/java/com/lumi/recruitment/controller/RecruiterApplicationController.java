package com.lumi.recruitment.controller;
import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/recruiter/applications")
public class RecruiterApplicationController {
 private final ApplicationService service;
 private final com.lumi.recruitment.service.AiAnalysisTaskService aiTasks;
 @GetMapping("/{id}/ai-status") public ApiResponse<ApplicationAiStatusDto> aiStatus(Authentication auth,@PathVariable UUID id,jakarta.servlet.http.HttpServletResponse response) {
  response.setHeader("Cache-Control","no-store");
  return ApiResponse.ok("Tiến độ phân tích hồ sơ.",aiTasks.status(auth,id,true));
 }
 @GetMapping public ApiResponse<ApplicationDto.PageDto> list(Authentication auth,
  @RequestParam(required=false) UUID jobId,@RequestParam(defaultValue="") String stage,
  @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.ok("Danh sách hồ sơ.",service.list(auth,true,jobId,stage,search,page,size));
 }
 @GetMapping("/{id}") public ApiResponse<ApplicationDto> detail(Authentication auth,@PathVariable UUID id) {
  return ApiResponse.ok("Hồ sơ đã nộp.",service.detail(auth,true,id));
 }
 @GetMapping("/{id}/review") public ApiResponse<ApplicationReviewDto> review(Authentication auth,@PathVariable UUID id) {
  return ApiResponse.ok("Thông tin xử lý nội bộ.",service.review(auth,id));
 }
 @PostMapping("/{id}/notes") @ResponseStatus(HttpStatus.CREATED)
 public ApiResponse<ApplicationReviewDto> addNote(Authentication auth,@PathVariable UUID id,@Valid @RequestBody AddApplicationNoteRequest input) {
  return ApiResponse.ok("Đã lưu ghi chú nội bộ.",service.addNote(auth,id,input));
 }
 @PostMapping("/{id}/status") public ApiResponse<ApplicationReviewDto> changeStatus(Authentication auth,@PathVariable UUID id,@Valid @RequestBody ChangeApplicationStatusRequest input) {
  return ApiResponse.ok("Đã cập nhật vòng tuyển dụng.",service.changeStatus(auth,id,input));
 }
 @GetMapping("/summary") public ApiResponse<ApplicationDto.Summary> summary(Authentication auth,@RequestParam(required=false) UUID jobId) {
  return ApiResponse.ok("Thống kê hồ sơ.",service.summary(auth,jobId));
 }
}
