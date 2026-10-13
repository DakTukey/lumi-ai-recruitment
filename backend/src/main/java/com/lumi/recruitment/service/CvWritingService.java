package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.CvWritingDto;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class CvWritingService {
    private final UserRepository users;
    private final AiServiceClient ai;
    private final Semaphore capacity = new Semaphore(2);
    private final Set<UUID> running = ConcurrentHashMap.newKeySet();
    private static final Pattern NUMBERS = Pattern.compile("\\d+(?:[.,]\\d+)*%?");
    private static final Pattern URLS = Pattern.compile("https?://[^\\s]+");

    public CvWritingDto.Result rewrite(Authentication auth, CvWritingDto.Request input) {
        return withCapacity(auth, () -> {
            var normalized = new CvWritingDto.Request(input.section(), input.action(), input.text().trim(),
                input.context() == null ? "" : input.context().trim());
            var result = ai.rewriteCv(normalized);
            validateResult(normalized, result);
            return result;
        });
    }
    public <T> T withCapacity(Authentication auth, java.util.function.Supplier<T> work) {
        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.CANDIDATE) throw new AccessDeniedException("Chỉ dành cho ứng viên.");
        if (!running.add(user.getId())) throw busy();
        boolean acquired = capacity.tryAcquire();
        try {
            if (!acquired) throw busy();
            return work.get();
        } finally {
            if (acquired) capacity.release();
            running.remove(user.getId());
        }
    }
    public static void validateResult(CvWritingDto.Request input, CvWritingDto.Result result) {
        if (result == null || result.suggestion() == null || result.suggestion().isBlank()
            || result.suggestion().length() > 6000 || result.questions() == null || result.questions().size() > 3
            || result.questions().stream().anyMatch(q -> q == null || q.isBlank() || q.length() > 240)
            || !"cv-writing-v1".equals(result.prompt_version()) || result.model_name() == null || result.model_name().isBlank()
            || !tokens(NUMBERS, input.text()).containsAll(tokens(NUMBERS, result.suggestion()))
            || !tokens(URLS, input.text()).containsAll(tokens(URLS, result.suggestion())))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Đề xuất AI chưa hợp lệ. Nội dung CV của bạn vẫn được giữ nguyên; vui lòng thử lại.");
    }
    private static Set<String> tokens(Pattern pattern, String text) {
        return pattern.matcher(text).results().map(m -> m.group()).collect(Collectors.toSet());
    }
    private ResponseStatusException busy() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "AI đang xử lý yêu cầu. Vui lòng thử lại sau.");
    }
}
