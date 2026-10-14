package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.AiServiceResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Component @RequiredArgsConstructor
public class AssessmentContext {
    public static final String PROMPT_VERSION="v3", EVALUATION_VERSION="evidence-fit-v3";
    private final ObjectMapper mapper;
    public record Target(String name,boolean required,BigDecimal weight) {}
    public record Input(JsonNode job,JsonNode resume,String jobHash,String inputHash) {}
    public Input input(JsonNode job,JsonNode resume) {
        var normalizedJob=job(job);var normalizedResume=resume(resume);
        String jobHash=hash(normalizedJob);
        return new Input(normalizedJob,normalizedResume,jobHash,hash(List.of(EVALUATION_VERSION,normalizedJob,normalizedResume)));
    }
    public JsonNode job(JsonNode source) {
        Map<String,Object> data=new TreeMap<>();
        for(String key:List.of("title","description","requirements","benefits","location","employmentType","workMode","experienceLevel")) data.put(key,source.path(key).asText(""));
        var skills=new ArrayList<Map<String,Object>>();
        for(var s:source.path("skills")) skills.add(new TreeMap<>(Map.of("id",s.path("id").asText(),"name",s.path("name").asText(),"required",s.path("required").asBoolean())));
        skills.sort(Comparator.comparing(s->s.get("id").toString()));data.put("skills",skills);
        var criteria=new ArrayList<Map<String,Object>>();
        for(var c:source.path("criteria")) criteria.add(new TreeMap<>(Map.of("id",c.path("id").asText(),"type",c.path("type").asText(),"description",c.path("description").asText(),"required",c.path("required").asBoolean(),"weight",new BigDecimal(c.path("weight").asText("0")).stripTrailingZeros())));
        criteria.sort(Comparator.comparing(c->c.get("id").toString()));data.put("criteria",criteria);
        return mapper.valueToTree(data);
    }
    public JsonNode resume(JsonNode source) {
        Map<String,Object> data=new TreeMap<>();
        for(String key:List.of("desiredPosition","summary","githubUrl","portfolioUrl")) data.put(key,source.path(key).asText(""));
        for(String key:List.of("skills","experiences","educations","projects","certifications","languages","awards","activities","extraSections"))
            data.put(key,source.path(key).isArray()?source.path(key):List.of());
        return mapper.valueToTree(data);
    }
    public String jobHash(JsonNode source) {return hash(job(source));}
    private String hash(Object value) {
        Object raw=mapper.readValue(mapper.writeValueAsString(value),Object.class);
        try {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsString(canonical(raw)).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e) {throw new IllegalStateException(e);}
    }
    private Object canonical(Object value) {
        if(value instanceof Map<?,?> m) {Map<String,Object> sorted=new TreeMap<>();m.forEach((k,v)->sorted.put(k.toString(),canonical(v)));return sorted;}
        if(value instanceof List<?> l) return l.stream().map(this::canonical).toList();
        if(value instanceof Number n) return new BigDecimal(n.toString()).stripTrailingZeros().toPlainString();
        return value;
    }
    public static Map<String,Target> targets(JsonNode job) {
        Map<String,Target> targets=new LinkedHashMap<>();
        for(var s:job.path("skills")) targets.put("skill:"+s.path("id").asText(),new Target(s.path("name").asText(),s.path("required").asBoolean(),BigDecimal.valueOf(s.path("required").asBoolean()?2:1)));
        for(var c:job.path("criteria")) targets.put("criterion:"+c.path("id").asText(),new Target(c.path("description").asText(),c.path("required").asBoolean(),new BigDecimal(c.path("weight").asText("0"))));
        return targets;
    }
    public static boolean contains(JsonNode node,String quote) {
        if(node.isString()) return node.asText().contains(quote);
        if(node.isContainer()) for(var child:node) if(contains(child,quote)) return true;
        return false;
    }
    private static boolean text(String s,int max) {return s!=null && !s.isBlank() && s.length()<=max;}
    private static ResponseStatusException invalid() {return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"AI chưa trả về đủ căn cứ hợp lệ. Chưa lưu kết quả; hãy thử lại.");}
    public static void validate(UUID request,Input input,AiServiceResult r) {
        var targets=targets(input.job());
        if(r==null || !request.equals(r.applicationId()) || !PROMPT_VERSION.equals(r.promptVersion()) || !text(r.modelName(),100)
            || !text(r.summary(),10000) || r.score()==null || r.criteria()==null || targets.isEmpty() || r.criteria().size()!=targets.size()
            || r.gaps()==null || r.gaps().size()>4 || r.interviewQuestions()==null || r.interviewQuestions().size()>5
            || r.matchedSkills()==null || r.missingSkills()==null) throw invalid();
        Set<String> seen=new HashSet<>();BigDecimal sum=BigDecimal.ZERO,total=BigDecimal.ZERO;
        for(var c:r.criteria()) {
            if(c==null) throw invalid();var t=targets.get(c.key());
            if(t==null || !seen.add(c.key()) || !t.name().equals(c.skill()) || c.weight()==null || c.weight().compareTo(t.weight())!=0
                || c.points()==null || c.points()<0 || c.points()>100 || !text(c.reason(),20000)
                || !Set.of("MATCHED","PARTIAL","NO_EVIDENCE").contains(c.matchLevel()==null?"":c.matchLevel())
                || c.evidence()==null || c.evidence().length()>20000) throw invalid();
            if("NO_EVIDENCE".equals(c.matchLevel()) ? c.points()!=0 || !c.evidence().isBlank() : !text(c.evidence(),20000) || !contains(input.resume(),c.evidence())) throw invalid();
            sum=sum.add(c.weight().multiply(BigDecimal.valueOf(c.points())));total=total.add(c.weight());
        }
        if((total.signum()==0?0:sum.divide(total,0,RoundingMode.HALF_UP).intValueExact())!=r.score()) throw invalid();
        Set<String> names=new HashSet<>();targets.values().forEach(t->names.add(t.name()));
        for(var g:r.gaps()) if(g==null || !names.contains(g.skill()) || !text(g.roadmap(),2000) || !text(g.currentLevel(),2000) || !text(g.targetLevel(),2000)) throw invalid();
        for(var q:r.interviewQuestions()) if(q==null || !text(q.question(),2000) || !text(q.reason(),2000) || !text(q.targetSkill(),2000)) throw invalid();
    }
}
