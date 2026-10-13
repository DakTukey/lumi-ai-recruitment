package com.lumi.recruitment.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tóm tắt ứng viên điểm cao cho widget "Top ứng viên được gợi ý".
 * Chỉ trả về thông tin cần thiết để hiển thị danh sách nhanh.
 */
public record TopCandidateDto(
        UUID applicationId,
        String candidateName,
        String candidateEmail,
        String resumeTitle,
        int score,
        String summary,
        List<String> matchedSkills,
        List<String> missingSkills,
        String applicationStatus,
        Instant assessedAt
) {}
