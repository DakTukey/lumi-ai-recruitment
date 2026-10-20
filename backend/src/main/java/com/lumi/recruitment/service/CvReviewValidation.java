package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.candidate.ResumeStatus;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.util.*;

/** Uses the same bounds and date rules as the CV editor; warnings never fabricate facts. */
@Component @RequiredArgsConstructor
public class CvReviewValidation {
    private final Validator validator;
    private final ObjectMapper mapper;
    public record Issue(String path, String severity, String message) {}
    private static <T> List<T> list(List<T> value) {return value==null?List.of():value;}
    /** Normalize only a reviewed copy. Never rewrite the original PDF extraction/evidence. */
    public ParsedResumeDto normalizeLinks(ParsedResumeDto input) {
        if(input==null) return null;
        var tree=(ObjectNode)mapper.valueToTree(input);
        for(String key:List.of("githubUrl","linkedinUrl","portfolioUrl")) normalizeLink(tree,key);
        for(var item:tree.path("projects")) if(item instanceof ObjectNode object) normalizeLink(object,"url");
        for(var item:tree.path("certifications")) if(item instanceof ObjectNode object) normalizeLink(object,"credentialUrl");
        return mapper.treeToValue(tree,ParsedResumeDto.class);
    }
    private static void normalizeLink(ObjectNode object,String field) {
        var value=object.get(field);
        if(value==null || !value.isTextual()) return;
        String text=value.asText().strip();
        if(text.regionMatches(true,0,"https://",0,8)) text="https://"+text.substring(8);
        else if(text.regionMatches(true,0,"http://",0,7)) text="http://"+text.substring(7);
        else if(!text.isEmpty()) {
            String candidate=text.startsWith("//")?"https:"+text:"https://"+text;
            try {
                var uri=URI.create(candidate);
                if(uri.getHost()!=null && uri.getHost().contains(".") && uri.getRawUserInfo()==null && uri.getPort()<=65535)
                    text=candidate;
            } catch(IllegalArgumentException ignored) {}
        }
        object.put(field,text);
    }
    public static String label(String path) {
        return switch(path) {
            case "portfolioUrl" -> "Portfolio / Website";
            case "githubUrl" -> "GitHub";
            case "linkedinUrl" -> "LinkedIn";
            default -> path;
        };
    }
    public List<Issue> issues(ParsedResumeDto p) {
        if(p==null) return List.of();
        p=normalizeLinks(p);
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
                :path.toLowerCase(Locale.ROOT).endsWith("url")?"Liên kết cần đúng định dạng http:// hoặc https://, tối đa 2048 ký tự. Có thể để trống nếu không có."
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
