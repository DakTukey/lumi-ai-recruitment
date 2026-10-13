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
@RequestMapping("/api/candidate/applications")
public class CandidateApplicationController {
 private final ApplicationService service;
 private final com.lumi.recruitment.service.AiAnalysisTaskService aiTasks;
 @GetMapping public ApiResponse<ApplicationDto.PageDto> list(Authentication auth,
  @RequestParam(required=false) UUID jobId,@RequestParam(defaultValue="") String stage,
  @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
  return ApiResponse.ok("Danh sách hồ sơ.",service.list(auth,false,jobId,stage,search,page,size));
 }
 @GetMapping("/{id}") public ApiResponse<ApplicationDto> detail(Authentication auth,@PathVariable UUID id) {
  return ApiResponse.ok("Hồ sơ đã nộp.",service.detail(auth,false,id));
 }
 @GetMapping("/{id}/ai-status") public ApiResponse<ApplicationAiStatusDto> aiStatus(Authentication auth,@PathVariable UUID id,jakarta.servlet.http.HttpServletResponse response) {
  response.setHeader("Cache-Control","no-store");
  return ApiResponse.ok("Tiến độ phân tích hồ sơ của bạn.",aiTasks.status(auth,id));
 }
 @PostMapping @ResponseStatus(HttpStatus.CREATED)
 public ApiResponse<ApplicationDto> submit(Authentication auth,@Valid @RequestBody SubmitApplicationRequest input) {
  return ApiResponse.ok("Đã gửi hồ sơ đến nhà tuyển dụng.",service.submit(auth,input));
 }
}
