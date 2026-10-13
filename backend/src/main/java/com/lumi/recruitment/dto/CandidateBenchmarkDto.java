package com.lumi.recruitment.dto;
import java.time.Instant;
import java.util.List;
public record CandidateBenchmarkDto(String status,int minimumPeers,int totalPeers,int analyzedPeers,int pendingPeers,
    Integer ownScore,Double medianScore,Double percentile,Double lowerPercent,Double equalPercent,Double higherPercent,
    List<Criterion> criteria,Instant asOf) {
    public record Criterion(String id,String name,boolean required,double weight,Integer ownScore,String ownStatus,
        Double peerMedian,int peerEvidenceCount,int peerCount,double evidencePercent,Double difference,double priority,String action) {}
}
