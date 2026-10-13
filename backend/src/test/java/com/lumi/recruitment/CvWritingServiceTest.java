package com.lumi.recruitment;

import com.lumi.recruitment.dto.CvWritingDto;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import com.lumi.recruitment.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CvWritingServiceTest {
    private CvWritingDto.Request input() {
        return new CvWritingDto.Request("project", "polish", "Web React, nhóm 3 người.", null);
    }
    private CvWritingDto.Result result(String text) {
        return new CvWritingDto.Result(text, List.of("Bạn phụ trách chức năng nào?"), "test-model", "cv-writing-v1");
    }
    @Test void rejectsFabricatedNumericClaimsAndLinks() {
        assertDoesNotThrow(() -> CvWritingService.validateResult(input(), result("Làm web React trong nhóm 3 người.")));
        for (String text : List.of("Tăng doanh thu 20%.", "Có 5 năm kinh nghiệm.", "https://made-up.test", " ", "x".repeat(6001)))
            assertThrows(ResponseStatusException.class, () -> CvWritingService.validateResult(input(), result(text)));
        assertThrows(ResponseStatusException.class, () -> CvWritingService.validateResult(input(),
            new CvWritingDto.Result("React", List.of("?", "?", "?", "?"), "model", "cv-writing-v1")));
    }
    @Test void checksAccountAndRoleBeforeCallingAi() {
        var users = mock(UserRepository.class, withSettings().mockMaker("mock-maker-subclass")); var ai = mock(AiServiceClient.class, withSettings().mockMaker("mock-maker-subclass"));
        var service = new CvWritingService(users, ai);
        var auth = mock(Authentication.class, withSettings().mockMaker("mock-maker-subclass")); when(auth.getName()).thenReturn("candidate@example.test");
        var user = User.builder().id(UUID.randomUUID()).email("candidate@example.test").fullName("Test")
            .role(UserRole.RECRUITER).status(UserStatus.ACTIVE).build();
        when(users.findByEmail(auth.getName())).thenReturn(Optional.of(user));
        assertThrows(AccessDeniedException.class, () -> service.rewrite(auth, input()));
        user.setRole(UserRole.CANDIDATE); user.setStatus(UserStatus.INACTIVE);
        assertThrows(BadCredentialsException.class, () -> service.rewrite(auth, input()));
        verifyNoInteractions(ai);
    }
    @Test void releasesCapacityAfterFailureAndDoesNotPersistAnyResume() {
        var users = mock(UserRepository.class, withSettings().mockMaker("mock-maker-subclass")); var ai = mock(AiServiceClient.class, withSettings().mockMaker("mock-maker-subclass"));
        var service = new CvWritingService(users, ai);
        var auth = mock(Authentication.class, withSettings().mockMaker("mock-maker-subclass")); when(auth.getName()).thenReturn("candidate@example.test");
        when(users.findByEmail(auth.getName())).thenReturn(Optional.of(User.builder().id(UUID.randomUUID())
            .email("candidate@example.test").fullName("Test").role(UserRole.CANDIDATE).status(UserStatus.ACTIVE).build()));
        when(ai.rewriteCv(any())).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE))
            .thenReturn(result("Tham gia làm web React trong nhóm 3 người."));
        assertThrows(ResponseStatusException.class, () -> service.rewrite(auth, input()));
        assertEquals("Tham gia làm web React trong nhóm 3 người.", service.rewrite(auth, input()).suggestion());
        verify(ai, times(2)).rewriteCv(new CvWritingDto.Request("project", "polish", input().text(), ""));
        verify(users, never()).save(any());
    }
}
