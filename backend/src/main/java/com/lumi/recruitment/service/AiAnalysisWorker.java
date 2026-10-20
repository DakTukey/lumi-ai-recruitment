package com.lumi.recruitment.service;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import java.util.concurrent.*;

@Component @Slf4j
@ConditionalOnProperty(name="app.ai-analysis.worker-enabled",havingValue="true",matchIfMissing=true)
public class AiAnalysisWorker {
    private final AiAnalysisTaskService tasks;
    private final Semaphore slots;
    private final ExecutorService pool;
    private final int concurrency;
    public AiAnalysisWorker(AiAnalysisTaskService tasks, @Value("${app.ai-analysis.max-concurrency:1}") int configuredConcurrency) {
        this.tasks=tasks;
        this.concurrency=Math.max(1,Math.min(2,configuredConcurrency));
        this.slots=new Semaphore(concurrency);
        this.pool=Executors.newFixedThreadPool(concurrency,r->{var t=new Thread(r,"application-ai-worker");t.setDaemon(true);return t;});
    }
    @Scheduled(fixedDelayString="${app.ai-analysis.poll-delay-ms:3000}",initialDelayString="${app.ai-analysis.initial-delay-ms:10000}")
    public void dispatch() {
        for(int i=0;i<concurrency;i++) {
            if(!slots.tryAcquire()) return;
            try {
                var task=tasks.claim();
                if(task==null) {slots.release();return;}
                pool.execute(()->{try {tasks.process(task);} finally {slots.release();}});
            } catch(Exception e) {slots.release();log.warn("AI queue dispatch unavailable ({})",e.getClass().getSimpleName());return;}
        }
    }
    @PreDestroy public void shutdown() {pool.shutdownNow();}
}
