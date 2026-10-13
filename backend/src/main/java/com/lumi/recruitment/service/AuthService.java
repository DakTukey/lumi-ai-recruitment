package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.entity.candidate.CandidateProfile;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CandidateProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;

    /**
     * Đăng ký tài khoản ứng viên mới.
     * Tự động tạo CandidateProfile rỗng kèm theo.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .role(UserRole.CANDIDATE)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(user);

       
        CandidateProfile profile = CandidateProfile.builder()
                .user(user)
                .build();
        profileRepository.save(profile);

        return AuthResponse.builder()
                .message("Đăng ký thành công!")
                .user(toDto(user))
                .build();
    }

 
    @Transactional(readOnly = true)
    public LoginResult login(LoginRequest request) {
        if (request.getPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadCredentialsException("Email hoặc mật khẩu không đúng.");
        }
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        request.getEmail().trim().toLowerCase(Locale.ROOT), request.getPassword()));
        AuthResponse response = AuthResponse.builder()
                .message("Đăng nhập thành công!")
                .user(currentUser(authentication))
                .build();
        return new LoginResult(authentication, response);
    }

    @Transactional(readOnly = true)
    public UserDto currentUser(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName())
                .filter(account -> account.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên đăng nhập không còn hợp lệ."));
        return toDto(user);
    }

    public record LoginResult(Authentication authentication, AuthResponse response) {
    }

    // ─── Mapper ───────────────────────────────────────────────────────────────

    private UserDto toDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .status(user.getStatus())
                .onboardingStatus(user.getRole() == UserRole.CANDIDATE
                        ? profileRepository.findById(user.getId()).map(CandidateProfile::getOnboardingStatus)
                            .orElse(com.lumi.recruitment.entity.candidate.OnboardingStatus.NOT_STARTED)
                        : null)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
