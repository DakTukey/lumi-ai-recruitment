package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.ParsedResumeDto;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

@Service
@RequiredArgsConstructor
@Slf4j
public class CvParserService {
    private final UserRepository users;
    private final AiServiceClient ai;
    private final Semaphore capacity = new Semaphore(2);
    private final Set<UUID> running = ConcurrentHashMap.newKeySet();

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    public ParsedResumeDto parsePdf(Authentication auth, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn tệp CV.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dung lượng tệp tối đa 10 MB.");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hệ thống chỉ hỗ trợ tệp định dạng PDF.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc dữ liệu tệp tải lên.");
        }

        var user = users.findByEmail(auth.getName()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(() -> new BadCredentialsException("Phiên không còn hợp lệ."));
        if (user.getRole() != UserRole.CANDIDATE) {
            throw new AccessDeniedException("Chỉ dành cho ứng viên.");
        }
        if (!running.add(user.getId())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Hệ thống đang quét một CV của bạn. Vui lòng chờ giây lát.");
        }

        boolean acquired = capacity.tryAcquire();
        try {
            if (!acquired) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "AI đang bận xử lý yêu cầu khác. Vui lòng thử lại sau giây lát.");
            }
            return ai.parseCv(bytes, filename);
        } finally {
            if (acquired) capacity.release();
            running.remove(user.getId());
        }
    }
}
