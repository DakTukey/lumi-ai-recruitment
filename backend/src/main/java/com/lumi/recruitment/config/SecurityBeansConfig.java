package com.lumi.recruitment.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.lumi.recruitment.repository.UserRepository;
import com.lumi.recruitment.entity.auth.UserStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@Configuration
public class SecurityBeansConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(UserRepository users, PasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(email -> {
            var account = users.findByEmail(email)
                    .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy tài khoản."));
            return User.withUsername(account.getEmail())
                    .password(account.getPasswordHash())
                    .roles(account.getRole().name())
                    .disabled(account.getStatus() != UserStatus.ACTIVE)
                    .build();
        });
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
}
