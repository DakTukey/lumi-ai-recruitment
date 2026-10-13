package com.lumi.recruitment.service;

import com.lumi.recruitment.dto.*;
import com.lumi.recruitment.entity.auth.*;
import com.lumi.recruitment.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor
public class CandidateBenchmarkService {
    private final CandidateJobMatchService matches;
    private final AssessmentContext contexts;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    @Value("${app.ai-analysis.minimum-benchmark-peers:10}") private int configuredMinimum;
    private record Peer(String jobHash,String jobJson,String model,String version,String evaluation,String assessmentHash,Integer score,JsonNode criteria,String taskState) {}
    @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public CandidateBenchmarkDto compare(Authentication auth,UUID job,UUID resume) {
        // This also checks active candidate, CV ownership/READY, live job and content fingerprint.
        var own=matches.getCachedMatch(auth,job,resume);
        int minimum=Math.max(10,configuredMinimum);
        if(own==null) return empty("NEEDS_MATCH",minimum,0,0,0,null);
        var user=users.findByEmail(auth.getName()).orElseThrow();
        String hash=jdbc.queryForObject("select job_context_hash from recruitment.candidate_job_matches where candidate_id=? and job_id=? and resume_id=? and evaluation_version=?",String.class,user.getId(),job,resume,AssessmentContext.EVALUATION_VERSION);
        if(hash==null) return empty("NEEDS_MATCH",minimum,0,0,0,null);
        var peers=jdbc.query("""
            select a.ai_job_context_hash,a.job_snapshot::text,ai.model_name,ai.prompt_version,ai.evaluation_version,ai.job_context_hash,
              ai.score,coalesce((select jsonb_agg(jsonb_build_object('id',c.criterion_key,'status',c.match_level,'score',c.points))
                from recruitment.ai_assessment_criteria c where c.assessment_id=ai.id),'[]'::jsonb)::text,t.status
            from recruitment.applications a join auth.users u on u.id=a.candidate_id
            left join lateral (select * from recruitment.ai_assessments where application_id=a.id order by created_at desc,id desc limit 1) ai on true
            left join recruitment.ai_analysis_tasks t on t.application_id=a.id
            where a.job_id=? and a.candidate_id<>? and a.status<>'WITHDRAWN' and u.status='ACTIVE'
            """,(rs,n)->new Peer(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6),rs.getObject(7,Integer.class),mapper.readTree(rs.getString(8)),rs.getString(9)),job,user.getId());
        var eligible=peers.stream().filter(p->hash.equals(p.jobHash()!=null?p.jobHash():contexts.jobHash(mapper.readTree(p.jobJson())))).toList();
        var analyzed=eligible.stream().filter(p->p.score()!=null && hash.equals(p.assessmentHash()) && own.modelName().equals(p.model())
            && AssessmentContext.PROMPT_VERSION.equals(p.version()) && AssessmentContext.EVALUATION_VERSION.equals(p.evaluation())).toList();
        int pending=(int)eligible.stream().filter(p->Set.of("PENDING","PROCESSING").contains(p.taskState()==null?"":p.taskState())).count();
        if(own.criteria().stream().mapToDouble(c->c.weight().doubleValue()).sum()<=0) return empty("UNWEIGHTED",minimum,eligible.size(),analyzed.size(),pending,null);
        if(analyzed.size()<minimum) return empty("INSUFFICIENT_DATA",minimum,eligible.size(),analyzed.size(),pending,own.score());
        var scores=analyzed.stream().map(Peer::score).sorted().toList();
        long lower=scores.stream().filter(s->s<own.score()).count(),equal=scores.stream().filter(s->s.equals(own.score())).count();
        var rows=new ArrayList<CandidateBenchmarkDto.Criterion>();
        for(var c:own.criteria()) {
            var values=new ArrayList<Integer>();
            for(var peer:analyzed) for(var pc:peer.criteria()) if(c.id().equals(pc.path("id").asText()) && !"NO_EVIDENCE".equals(pc.path("status").asText())) values.add(pc.path("score").asInt());
            values.sort(Integer::compareTo);Double median=values.size()>=5?median(values):null;
            Double difference=median==null || c.score()==null?null:round(c.score()-median);
            double priority=c.weight().doubleValue()*Math.max(0,median==null?0:median-(c.score()==null?0:c.score()));
            String action="NO_EVIDENCE".equals(c.status())?"CLARIFY":difference==null?"INSUFFICIENT_EVIDENCE":difference<0?"STRENGTHEN":"MAINTAIN";
            rows.add(new CandidateBenchmarkDto.Criterion(c.id(),c.name(),c.required(),c.weight().doubleValue(),c.score(),c.status(),median,values.size(),analyzed.size(),percent(values.size(),analyzed.size()),difference,priority,action));
        }
        return new CandidateBenchmarkDto("READY",minimum,eligible.size(),analyzed.size(),pending,own.score(),median(scores),percent(lower+equal*0.5,scores.size()),
            percent(lower,scores.size()),percent(equal,scores.size()),percent(scores.size()-lower-equal,scores.size()),rows,Instant.now());
    }
    private CandidateBenchmarkDto empty(String status,int minimum,int total,int analyzed,int pending,Integer score) {
        return new CandidateBenchmarkDto(status,minimum,total,analyzed,pending,score,null,null,null,null,null,List.of(),Instant.now());
    }
    static double median(List<Integer> sorted) {int n=sorted.size();return n%2==1?sorted.get(n/2):(sorted.get(n/2-1)+sorted.get(n/2))/2.0;}
    private static double percent(double count,int total) {return round(100*count/total);}
    private static double round(double value) {return Math.round(value*10)/10.0;}
}
