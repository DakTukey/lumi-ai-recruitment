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
}
