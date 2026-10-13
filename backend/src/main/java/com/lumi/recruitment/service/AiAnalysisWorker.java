package com.lumi.recruitment.service;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import java.util.concurrent.*;

@Component @RequiredArgsConstructor @Slf4j
@ConditionalOnProperty(name="app.ai-analysis.worker-enabled",havingValue="true",matchIfMissing=true)
public class AiAnalysisWorker {
    private final AiAnalysisTaskService tasks;
    private final Semaphore slots=new Semaphore(2);
    private final ExecutorService pool=Executors.newFixedThreadPool(2,r->{var t=new Thread(r,"application-ai-worker");t.setDaemon(true);return t;});
    @Scheduled(fixedDelayString="${app.ai-analysis.poll-delay-ms:3000}",initialDelayString="${app.ai-analysis.initial-delay-ms:10000}")
    public void dispatch() {
        for(int i=0;i<2;i++) {
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
