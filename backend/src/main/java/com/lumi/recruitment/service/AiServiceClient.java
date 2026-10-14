package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.AiServiceResult;
import com.lumi.recruitment.dto.JobSummaryDto;
import com.lumi.recruitment.dto.CvWritingDto;
import com.lumi.recruitment.dto.CvReviewDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

@Component @RequiredArgsConstructor @Slf4j
public class AiServiceClient {
    private final ObjectMapper mapper;
    @Value("${app.ai-service.url:http://localhost:8000}") private String aiServiceUrl;
    @Value("${app.ai-service.timeout-seconds:30}") private int timeoutSeconds;

    private RestClient restClient() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
            // Uvicorn serves HTTP/1.1; avoid a clear-text HTTP/2 upgrade corrupting POST parsing.
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(Math.min(5, Math.max(1, timeoutSeconds)))).build());
        factory.setReadTimeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)));
        return RestClient.builder().baseUrl(aiServiceUrl).requestFactory(factory).build();
    }
    public AiServiceResult assess(String applicationId, String jobJson, String resumeJson) {
        try {
            var body = Map.of("application_id", applicationId,
                "job", mapper.readTree(jobJson), "resume", mapper.readTree(resumeJson));
            var result = restClient().post().uri("/api/assess").contentType(MediaType.APPLICATION_JSON)
                .body(body).retrieve().body(AiServiceResult.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (Exception e) {
            // Never log a provider response body: it may contain CV evidence.
            log.warn("AI request failed for application {} ({})", applicationId, e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Không thể phân tích AI lúc này. Hãy kiểm tra dịch vụ AI và thử lại.");
        }
    }
    public boolean isHealthy() {
        try { restClient().get().uri("/health").retrieve().toBodilessEntity(); return true; }
        catch (Exception e) { return false; }
    }
    public CvWritingDto.Result rewriteCv(CvWritingDto.Request input) {
        try {
            var result = restClient().post().uri("/api/cv-writing").contentType(MediaType.APPLICATION_JSON)
                .body(input).retrieve().body(CvWritingDto.Result.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (Exception e) {
            log.warn("CV writing request failed ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa thể tạo gợi ý AI lúc này. Nội dung CV của bạn vẫn được giữ nguyên; hãy thử lại sau.");
        }
    }
    public CvReviewDto.Result reviewCv(CvReviewDto.Context resume, CvReviewDto.JobContext job) {
        var body = new java.util.HashMap<String,Object>(); body.put("resume", resume); body.put("job", job);
        return cvReviewCall("/api/cv-review", body, CvReviewDto.Result.class);
    }
    public CvReviewDto.Refined refineCv(CvReviewDto.RefineRequest input, CvReviewDto.JobContext job) {
        var body = new java.util.HashMap<String,Object>(); body.put("resume", input.resume()); body.put("job", job);
        body.put("target", input.target()); body.put("answer", input.answer());
        return cvReviewCall("/api/cv-review/refine", body, CvReviewDto.Refined.class);
    }
    private <T> T cvReviewCall(String path, Object input, Class<T> type) {
        try {
            var result = restClient().post().uri(path).contentType(MediaType.APPLICATION_JSON).body(input).retrieve().body(type);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (Exception e) {
            log.warn("CV review unavailable ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI chưa rà soát được lúc này. Bạn vẫn có thể chỉnh sửa và lưu CV; hãy thử lại sau.");
        }
    }
    public JobSummaryDto.Result summarizeJob(String jobId, String sourceHash, java.util.List<JobSummaryDto.Source> sources) {
        try {
            var result = restClient().post().uri("/api/job-summary").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("job_id", jobId, "source_hash", sourceHash, "sources", sources))
                .retrieve().body(JobSummaryDto.Result.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (Exception e) {
            log.warn("AI summary request failed for job {} ({})", jobId, e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa thể tóm tắt lúc này. Bạn vẫn có thể đọc nội dung tuyển dụng bên dưới.");
        }
    }
    public com.lumi.recruitment.dto.ParsedResumeDto parseCv(byte[] fileBytes, String filename) {
        try {
            org.springframework.util.MultiValueMap<String, Object> parts = new org.springframework.util.LinkedMultiValueMap<>();
            var resource = new org.springframework.core.io.ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return filename != null && !filename.isBlank() ? filename : "cv.pdf";
                }
            };
            parts.add("file", resource);
            var result = restClient().post().uri("/api/cv-parser")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve()
                .body(com.lumi.recruitment.dto.ParsedResumeDto.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.warn("CV parsing error from AI service (status {})", e.getStatusCode());
            if (e.getStatusCode().value() == 422) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Không thể bóc tách nội dung file này. Hãy thử file PDF khác hoặc nhập vào form.");
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI chưa bóc tách được CV lúc này. Bạn vẫn có thể tự điền vào form; hãy thử lại sau.");
        } catch (Exception e) {
            log.warn("CV parse request failed ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI chưa bóc tách được CV lúc này. Bạn vẫn có thể tự điền vào form; hãy thử lại sau.");
        }
    }

    public com.lumi.recruitment.dto.ParsedJobDraftDto parseJd(byte[] fileBytes, String filename, String text) {
        try {
            org.springframework.util.MultiValueMap<String, Object> parts = new org.springframework.util.LinkedMultiValueMap<>();
            if (fileBytes != null && fileBytes.length > 0) {
                var resource = new org.springframework.core.io.ByteArrayResource(fileBytes) {
                    @Override
                    public String getFilename() {
                        return filename != null && !filename.isBlank() ? filename : "jd.pdf";
                    }
                };
                parts.add("file", resource);
            }
            if (text != null && !text.isBlank()) {
                parts.add("text", text);
            }
            var result = restClient().post().uri("/api/jobs/parse-jd")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve()
                .body(com.lumi.recruitment.dto.ParsedJobDraftDto.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.warn("JD parsing error from AI service (status {})", e.getStatusCode());
            if (e.getStatusCode().value() == 422) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Không thể bóc tách nội dung JD này. Hãy kiểm tra lại tài liệu hoặc dán văn bản trực tiếp.");
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI phân tích JD tạm thời không khả dụng. Bạn vẫn có thể nhập thủ công; hãy thử lại sau.");
        } catch (Exception e) {
            log.warn("JD parse request failed ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI phân tích JD tạm thời không khả dụng. Bạn vẫn có thể nhập thủ công; hãy thử lại sau.");
        }
    }

    public com.lumi.recruitment.dto.ParsedJobDraftDto generateJd(com.lumi.recruitment.dto.GenerateJobDraftRequest request) {
        try {
            var result = restClient().post().uri("/api/jobs/generate-jd")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(com.lumi.recruitment.dto.ParsedJobDraftDto.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.warn("JD generate error from AI service (status {})", e.getStatusCode());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI soạn JD tạm thời không khả dụng. Bạn vẫn có thể nhập thủ công; hãy thử lại sau.");
        } catch (Exception e) {
            log.warn("JD generate request failed ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI soạn JD tạm thời không khả dụng. Bạn vẫn có thể nhập thủ công; hãy thử lại sau.");
        }
    }

    public com.lumi.recruitment.dto.GeneratedEmailDto generateRecruitmentEmail(java.util.Map<String, Object> payload) {
        try {
            var result = restClient().post().uri("/api/emails/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(com.lumi.recruitment.dto.GeneratedEmailDto.class);
            if (result == null) throw new IllegalStateException("Empty AI response");
            return result;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            log.warn("Email generate error from AI service (status {})", e.getStatusCode());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI tạo email tạm thời không khả dụng. Vui lòng thử lại sau.");
        } catch (Exception e) {
            log.warn("Email generate request failed ({})", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Dịch vụ AI tạo email tạm thời không khả dụng. Vui lòng thử lại sau.");
        }
    }
}
