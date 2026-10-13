package com.lumi.recruitment.dto;

import jakarta.validation.constraints.*;
import java.util.UUID;

/** Full self-service snapshot. Account identity and role are never writable here. */
public record RecruiterProfileRequest(
        @NotNull(message="Vui lòng tải lại hồ sơ.") @PositiveOrZero Long version,
        @Size(max=30, message="Số điện thoại tối đa 30 ký tự.") String phone,
        @Size(max=50, message="Mã nhân viên tối đa 50 ký tự.") String employeeCode,
        @Size(max=255, message="Chức danh tối đa 255 ký tự.") String jobTitle,
        UUID departmentId,
        @Size(max=2048, message="Đường dẫn ảnh tối đa 2048 ký tự.") String avatarUrl) {}
