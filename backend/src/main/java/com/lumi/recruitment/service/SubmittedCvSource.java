package com.lumi.recruitment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.UUID;

/** Read-only access to the exact submitted source. Never starts a PDF/provider request. */
@Component @RequiredArgsConstructor
public class SubmittedCvSource {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public record Source(JsonNode job, JsonNode resume, String state) {}
    public Source load(UUID application) {
        return jdbc.query("""
            select a.job_snapshot::text,s.content::text,a.submission_format,d.status,d.parsed_content::text
            from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id
            left join candidate.resume_documents d on d.id=a.source_document_id where a.id=?
            """,(r,n)->{
                var job=mapper.readTree(r.getString(1));var resume=mapper.readTree(r.getString(2));
                if(!"ORIGINAL_PDF".equals(r.getString(3))) return new Source(job,resume,"READY");
                if(resume.hasNonNull("pdfConfirmedAt") && resume.hasNonNull("pdfReviewedContent"))
                    return new Source(job,resume.path("pdfReviewedContent"),"READY");
                if("PARSED".equals(r.getString(4)) && r.getString(5)!=null)
                    return new Source(job,mapper.readTree(r.getString(5)),"READY");
                return new Source(job,mapper.createObjectNode(),"FAILED".equals(r.getString(4))?"FAILED":"PENDING");
            },application).stream().findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Không tìm thấy hồ sơ đã nộp."));
    }
    public Source ready(UUID application) {
        var source=load(application);
        if(!"READY".equals(source.state())) throw new ResponseStatusException(HttpStatus.CONFLICT,
            "CV chưa có dữ liệu đọc hợp lệ. Hãy xem tiến độ hoặc phân tích lại tại mục Đánh giá AI trước.");
        return source;
    }
}
