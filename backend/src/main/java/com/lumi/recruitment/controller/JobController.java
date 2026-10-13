package com.lumi.recruitment.controller;
import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import java.util.*;
import java.math.BigDecimal;
@RestController @RequestMapping("/api") @RequiredArgsConstructor
@ConditionalOnWebApplication(type=ConditionalOnWebApplication.Type.SERVLET)
public class JobController {
 private final JobService service;
 @GetMapping("/departments") public ApiResponse<List<JobService.DepartmentDto>> departments() {return ApiResponse.ok("Phòng ban.",service.departments());}
 @GetMapping("/jobs") public ApiResponse<JobPageDto> list(
  @RequestParam(defaultValue="") String keyword, @RequestParam(required=false) UUID departmentId,
  @RequestParam(defaultValue="") List<String> level, @RequestParam(defaultValue="") List<String> workMode,
  @RequestParam(required=false) BigDecimal minSalary, @RequestParam(required=false) List<UUID> ids,
  @RequestParam(defaultValue="featured") String sort, @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="12") int size) {
  return ApiResponse.ok("Danh sách việc làm.",service.list(keyword,departmentId,level,workMode,minSalary,ids,sort,page,size));
 }
 @GetMapping("/jobs/{id}") public ApiResponse<JobDto> detail(@PathVariable UUID id) {return ApiResponse.ok("Chi tiết việc làm.",service.detail(id));}
}
