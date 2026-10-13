package com.lumi.recruitment;

import java.sql.DriverManager;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Never start migrations against the developer's application database during tests. */
@EnabledIfEnvironmentVariable(named = "LUMI_TEST_POSTGRES_URL", matches = ".+")
class RecruitmentBackendApplicationTests {
    @Test
    void contextLoads() throws Exception {
        String adminUrl = System.getenv("LUMI_TEST_POSTGRES_URL");
        String username = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_USER", "postgres");
        String password = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_PASSWORD", "");
        String database = "lumi_context_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(adminUrl, username, password);
             var sql = admin.createStatement()) {
            sql.execute("CREATE DATABASE " + database);
            try {
                String url = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + database;
                try (var context = new SpringApplicationBuilder(RecruitmentBackendApplication.class)
                        .web(WebApplicationType.NONE)
                        .run("--spring.datasource.url=" + url, "--spring.datasource.username=" + username,
                                "--spring.datasource.password=" + password)) {
                    assertTrue(context.isActive());
                }
            } finally {
                sql.execute("DROP DATABASE " + database);
            }
        }
    }
}
