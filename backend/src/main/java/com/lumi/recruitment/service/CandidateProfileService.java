package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.entity.candidate.*;
import com.lumi.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class CandidateProfileService {
    private final UserRepository users;
    private final CandidateProfileRepository profiles;
    private final CandidatePreferenceOptions options;

    private CandidateProfile ownedProfile(Authentication authentication) {
        User user = users.findByEmail(authentication.getName())
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BadCredentialsException("Phiên đăng nhập không còn hợp lệ."));
        if (user.getRole() != UserRole.CANDIDATE) throw new AccessDeniedException("Chỉ dành cho ứng viên.");
        return profiles.findById(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy hồ sơ ứng viên."));
    }

    @Transactional(readOnly = true)
    public CandidateProfileDto get(Authentication authentication) {
        return dto(ownedProfile(authentication));
    }

    @Transactional
    public CandidateProfileDto save(Authentication authentication, CandidateProfileRequest request, Integer step) {
        if (step != null && (step < 0 || step > 2)) throw new IllegalArgumentException("Bước không hợp lệ.");
        CandidateProfile p = ownedProfile(authentication);
        p.getUser().setFullName(request.fullName().trim());
        p.setPhone(clean(request.phone()));
        p.setLocation(clean(request.location()));
        boolean undecided = request.positionUndecided() == null ? p.isPositionUndecided() : request.positionUndecided();
        p.setPositionUndecided(undecided);
        p.setDesiredPosition(undecided ? null : clean(request.desiredPosition()));
        var supported = options.get();
        p.setEmploymentTypes(options.validate(request.employmentTypes(), supported.employmentTypes(), p.getEmploymentTypes()));
        p.setWorkModes(options.validate(request.workModes(), supported.workModes(), p.getWorkModes()));
        p.setPreferredLocations(options.validate(request.preferredLocations(), supported.locations(), p.getPreferredLocations()));
        p.setExperienceRange(request.experienceRange());
        p.setSkills(clean(request.skills()));
        p.setExperienceYears(request.experienceYears());
        p.setUpdatedAt(Instant.now());
        if (step != null) {
            p.setOnboardingStep(Math.min(step + 1, 2));
            p.setOnboardingStatus(step == 2 ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS);
        }
        return dto(p);
    }

    @Transactional
    public CandidateProfileDto skip(Authentication authentication) {
        CandidateProfile p = ownedProfile(authentication);
        if (p.getOnboardingStatus() != OnboardingStatus.COMPLETED) p.setOnboardingStatus(OnboardingStatus.SKIPPED);
        p.setUpdatedAt(Instant.now());
        return dto(p);
    }
    

    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private CandidateProfileDto dto(CandidateProfile p) {
        return new CandidateProfileDto(p.getUserId(), p.getUser().getFullName(), p.getUser().getEmail(),
                p.getPhone(), p.getLocation(), p.getDesiredPosition(), p.getSkills(), p.getExperienceYears(),
                p.getOnboardingStatus(), p.getOnboardingStep(), p.getUpdatedAt(),
                p.getEmploymentTypes(), p.getWorkModes(), p.getPreferredLocations(), p.getExperienceRange(), p.isPositionUndecided());
    }
}
