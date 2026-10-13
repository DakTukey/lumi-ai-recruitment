package com.lumi.recruitment.controller;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthController {

    private final AuthService authService;
    private final SecurityContextRepository securityContexts;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final CsrfTokenRepository csrfTokens;

    /**
     * POST /api/auth/register
     * Đăng ký tài khoản ứng viên mới.
     *
     * Body: { "email": "...", "password": "...", "fullName": "..." }
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        AuthResponse result = authService.register(request);
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                result.getUser().getEmail(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + result.getUser().getRole().name())));
        saveSession(authentication, httpRequest, httpResponse);
        return ResponseEntity.status(201)
                .body(ApiResponse.ok("Đăng ký thành công!", result));
    }

    /**
     * POST /api/auth/login
     * Đăng nhập bằng email và mật khẩu.
     *
     * Body: { "email": "...", "password": "..." }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        AuthService.LoginResult result = authService.login(request);
        saveSession(result.authentication(), httpRequest, httpResponse);
        return ResponseEntity.ok(ApiResponse.ok("Đăng nhập thành công!", result.response()));
    }

    private void saveSession(Authentication authentication,
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        sessionStrategy.onAuthentication(authentication, httpRequest, httpResponse);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContexts.saveContext(context, httpRequest, httpResponse);
    }

    @GetMapping("/me")
    public ApiResponse<UserDto> me(Authentication authentication) {
        return ApiResponse.ok("Thông tin tài khoản.", authService.currentUser(authentication));
    }

    @GetMapping("/csrf")
    public ApiResponse<CsrfResponse> csrf(CsrfToken token) {
        return ApiResponse.ok("CSRF token.", new CsrfResponse(token.getHeaderName(), token.getToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) {
        csrfTokens.saveToken(null, request, response);
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return ApiResponse.ok("Đã đăng xuất.", null);
    }

    /**
     * GET /api/auth/ping
     * Kiểm tra Backend đang chạy.
     */
    @GetMapping("/ping")
    public ResponseEntity<ApiResponse<String>> ping() {
        return ResponseEntity.ok(ApiResponse.ok("Backend đang hoạt động!", "pong"));
    }
}
