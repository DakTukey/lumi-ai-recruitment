package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.ApiResponse;
import com.lumi.recruitment.dto.ValidationErrorDto;
import com.lumi.recruitment.service.EmailAlreadyRegisteredException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    public ResponseEntity<ApiResponse<Void>> concurrentUpdate(Exception error) {
        return ResponseEntity.status(409).body(ApiResponse.error("Tin vừa được người khác cập nhật. Hãy tải lại tin trước khi thao tác tiếp."));
    }
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> status(org.springframework.web.server.ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(ApiResponse.error(error.getReason()));
    }
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> invalidParameter(Exception error) {
        return ResponseEntity.badRequest().body(ApiResponse.error("Tham số không hợp lệ."));
    }


    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<ApiResponse<Void>> duplicateEmail(EmailAlreadyRegisteredException exception) {
        return ResponseEntity.status(409).body(ApiResponse.error(exception.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> authentication(AuthenticationException exception,
            HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.status(401).body(ApiResponse.error("Email hoặc mật khẩu không đúng, hoặc tài khoản không còn hoạt động."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> validation(MethodArgumentNotValidException exception) {
        ApiResponse<Void> response = ApiResponse.error("Vui lòng kiểm tra thông tin đã nhập.");
        response.setErrors(exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ValidationErrorDto(error.getField(), error.getDefaultMessage())).toList());
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> malformedJson(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.error("Dữ liệu gửi lên không hợp lệ."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> invalidInput(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.error("Thông tin không hợp lệ hoặc email đã được sử dụng."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> conflict(DataIntegrityViolationException exception) {
        return ResponseEntity.status(409).body(ApiResponse.error("Thông tin bị trùng hoặc không hợp lệ."));
    }
}
