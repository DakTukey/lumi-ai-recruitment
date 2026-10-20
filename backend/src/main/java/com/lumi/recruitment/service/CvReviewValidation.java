package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.candidate.ResumeStatus;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;

/** Uses the same bounds and date rules as the CV editor; warnings never fabricate facts. */
@Component @RequiredArgsConstructor
public class CvReviewValidation {
    private final Validator validator;
    public record Issue(String path, String severity, String message) {}
    private static <T> List<T> list(List<T> value) {return value==null?List.of():value;}
    public List<Issue> issues(ParsedResumeDto p) {
        if(p==null) return List.of();
        var request=new ResumeRequest(p.title(),p.fullName(),p.email(),p.phone(),p.location(),p.desiredPosition(),p.summary(),
            p.githubUrl(),p.linkedinUrl(),p.portfolioUrl(),list(p.skills()),list(p.experiences()),list(p.educations()),
            list(p.projects()),list(p.certifications()),list(p.languages()),list(p.awards()),list(p.activities()),
            "modern",ResumeStatus.DRAFT,null,null,list(p.extraSections()));
        var result=new ArrayList<Issue>();
        validator.validate(request).stream().sorted(Comparator.comparing(v->v.getPropertyPath().toString())).limit(100).forEach(v->{
            String path=v.getPropertyPath().toString();
            String message=path.contains("dateRangeValid")?"Thời gian kết thúc phải sau thời gian bắt đầu; mục đang làm cần để trống ngày kết thúc."
                :path.contains("gpaValid")?"GPA cần đúng thang điểm 4, 10 hoặc 100."
                :path.equals("email")?"Email chưa đúng định dạng."
                :path.equals("phone")?"Số điện thoại chưa đúng định dạng hoặc quá dài."
                :"Kiểm tra định dạng, độ dài hoặc thông tin còn trống ở mục này.";
            result.add(new Issue(path,"ERROR",message));
        });
        if(p.fullName()==null || p.fullName().isBlank()) result.add(new Issue("fullName","ERROR","Điền họ tên trước khi xác nhận."));
        for(int i=0;i<list(p.experiences()).size();i++) {
            var e=p.experiences().get(i);
            if(e!=null && (e.company()==null || e.company().isBlank()))
                result.add(new Issue("experiences."+i+".company","WARNING","Kinh nghiệm chưa có tên công ty. Kiểm tra xem đây có phải dự án cá nhân không."));
        }
        for(int i=0;i<list(p.educations()).size();i++) {
            var e=p.educations().get(i);
            if(e!=null && (e.school()==null || e.school().isBlank()))
                result.add(new Issue("educations."+i+".school","WARNING","Học vấn chưa có tên trường."));
        }
        return List.copyOf(result);
    }
}
