package com.lumi.recruitment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@org.springframework.scheduling.annotation.EnableScheduling
@SpringBootApplication
public class RecruitmentBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(RecruitmentBackendApplication.class, args);
	}

}
