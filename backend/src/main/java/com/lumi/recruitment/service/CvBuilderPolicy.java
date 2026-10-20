package com.lumi.recruitment.service;

import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Legacy writes are closed by default; existing CVs and submitted snapshots remain readable. */
@Component
public class CvBuilderPolicy {
    private final Environment environment;
    public CvBuilderPolicy(Environment environment) { this.environment=environment; }
    public void requireEnabled() {
        if(!environment.getProperty("app.cv-builder.enabled",Boolean.class,false)) throw new ResponseStatusException(HttpStatus.GONE,
            "Tính năng tạo CV trên web đã ngừng. Hãy tải CV PDF trong CV của tôi; CV và đơn cũ vẫn xem được.");
    }
}
