package com.lumi.recruitment;

import com.lumi.recruitment.entity.auth.User;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.auth.UserStatus;
import com.lumi.recruitment.repository.UserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "LUMI_TEST_POSTGRES_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LoginFlowTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final String username = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_USER", "postgres");
    private final String password = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_PASSWORD", "");
    private String databaseName;
    private ConfigurableApplicationContext context;
    private UserRepository users;
    private String baseUrl;
    private com.sun.net.httpserver.HttpServer aiStub;
    private java.util.concurrent.ExecutorService aiExecutor;
    private final java.util.concurrent.atomic.AtomicInteger aiCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String aiMode = "ok";
    private volatile JsonNode lastAiRequest;
    private final java.util.concurrent.atomic.AtomicInteger summaryCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String summaryMode = "ok";
    private volatile JsonNode lastSummaryRequest;
    private volatile java.util.concurrent.CountDownLatch summaryEntered;
    private volatile java.util.concurrent.CountDownLatch summaryRelease;
    private final java.util.concurrent.atomic.AtomicInteger writingCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String writingMode = "ok";
    private volatile String reviewMode = "ok";
    private volatile JsonNode lastReviewRequest;
    private final java.util.concurrent.atomic.AtomicInteger reviewCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile java.util.concurrent.CountDownLatch matchEntered;
    private volatile java.util.concurrent.CountDownLatch matchRelease;
    private CookieManager cookies;
    private HttpClient client;

    @BeforeAll
    void startBackendOnIsolatedDatabase() throws Exception {
        String adminUrl = System.getenv("LUMI_TEST_POSTGRES_URL");
        databaseName = "lumi_login_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(adminUrl, username, password);
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + databaseName);
        }
        String databaseUrl = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + databaseName;
        aiStub = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
        aiExecutor = java.util.concurrent.Executors.newCachedThreadPool();aiStub.setExecutor(aiExecutor);
        aiStub.createContext("/api/assess", exchange -> {
            String mode=aiMode;aiCalls.incrementAndGet();
            try {
                // Uvicorn rejects the JDK client's h2c upgrade; fail tests if it returns.
                if (exchange.getRequestHeaders().getFirst("Upgrade") != null) {
                    exchange.sendResponseHeaders(400, -1);
                    return;
                }
                var input=mapper.readTree(new String(exchange.getRequestBody().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
                lastAiRequest=input;
                if(mode.equals("match-hold")) {matchEntered.countDown();matchRelease.await(3,java.util.concurrent.TimeUnit.SECONDS);}
                if(mode.equals("slow"))Thread.sleep(1500);
                if(mode.equals("concurrent"))Thread.sleep(350);
                int status=mode.equals("unavailable")?503:200;
                String body=mode.equals("unavailable")?"{}":mapper.writeValueAsString(aiStubResult(input,mode));
                byte[] bytes=body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(status,bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch(Exception ignored) { /* Client timeout deliberately closes the exchange. */ }
            finally {exchange.close();}
        });
        aiStub.createContext("/api/job-summary", exchange -> {
            summaryCalls.incrementAndGet();
            try {
                if (exchange.getRequestHeaders().getFirst("Upgrade") != null) {
                    exchange.sendResponseHeaders(400, -1); return;
                }
                var input = mapper.readTree(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                lastSummaryRequest = input;
                String mode = summaryMode;
                if (mode.equals("hold")) {
                    summaryEntered.countDown(); summaryRelease.await(3, java.util.concurrent.TimeUnit.SECONDS);
                }
                if (mode.equals("slow")) Thread.sleep(1500);
                var source = input.path("sources").get(1);
                var item = Map.of("category", mode.equals("bad-category") ? "preferred" : "responsibilities",
                    "text", "Build APIs", "source_id", source.path("id").asText(),
                    "quote", mode.equals("bad-quote") ? "Invented salary" : source.path("text").asText());
                var result = Map.of("job_id", input.path("job_id").asText(),
                    "source_hash", mode.equals("bad-hash") ? "b".repeat(64) : input.path("source_hash").asText(),
                    "model_name", "test-model", "prompt_version", "job-summary-v2",
                    "items", mode.equals("empty") ? java.util.List.of() : java.util.List.of(item));
                byte[] bytes = mapper.writeValueAsString(result).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(mode.equals("unavailable") ? 503 : 200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (Exception ignored) { /* Deliberately disconnected timeout client. */ }
            finally { exchange.close(); }
        });
        aiStub.createContext("/api/cv-writing", exchange -> {
            writingCalls.incrementAndGet();
            try {
                var input = mapper.readTree(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                String mode = writingMode;
                if (mode.equals("slow")) Thread.sleep(1500);
                String text = mode.equals("invented") ? "Tăng doanh thu 20%." : "Tham gia phát triển giỏ hàng bằng React.";
                var result = Map.of("suggestion", text, "questions", java.util.List.of("Bạn đã triển khai những thao tác nào?"),
                    "model_name", "test-model", "prompt_version", "cv-writing-v1");
                assertEquals("project", input.path("section").asText());
                byte[] bytes = mapper.writeValueAsString(result).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(mode.equals("unavailable") ? 503 : 200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (Exception ignored) { /* Timeout test deliberately disconnects. */ }
            finally { exchange.close(); }
        });
        aiStub.createContext("/api/cv-review", exchange -> {
            reviewCalls.incrementAndGet();
            try {
                var input = mapper.readTree(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
                lastReviewRequest = input;
                String mode = reviewMode;
                if (mode.equals("slow")) Thread.sleep(1500);
                Object result;
                if (exchange.getRequestURI().getPath().endsWith("/refine")) {
                    result = Map.of("suggestion", mode.equals("invented") ? "Tăng hiệu suất 99%." : mode.equals("coaching") ? "CV hiện cần bổ sung. Bạn có thể viết thêm." : "Viết API mượn trả bằng Java trong nhóm 3 người.",
                        "questions", java.util.List.of(), "model_name", "test-model", "prompt_version", "cv-review-v1");
                } else {
                    var item = new java.util.HashMap<String,Object>();
                    item.put("section", "project"); item.put("index", mode.equals("badIndex") ? 29 : 0); item.put("kind", "CLARIFY");
                    item.put("reason", "Chưa rõ đóng góp cá nhân."); item.put("evidence", mode.equals("badEvidence") ? "Invented CV evidence" : "Làm website bằng Java.");
                    item.put("job_evidence", input.path("job").isNull() ? "" : input.at("/job/requirements").asText());
                    item.put("question", "Bạn phụ trách phần nào trong dự án?"); item.put("suggestion", "");
                    result = Map.of("overview", "Cần làm rõ đóng góp trong dự án.", "items", java.util.List.of(item), "model_name", "test-model", "prompt_version", "cv-review-v1");
                }
                byte[] bytes = mapper.writeValueAsString(result).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(mode.equals("unavailable") ? 503 : 200, bytes.length); exchange.getResponseBody().write(bytes);
            } catch (Exception ignored) { /* Timeout client deliberately disconnects. */ }
            finally { exchange.close(); }
        });
        aiStub.start();
        context = new SpringApplicationBuilder(RecruitmentBackendApplication.class, AccessProbe.class)
                .run("--server.port=0", "--app.ai-analysis.worker-enabled=false", "--app.ai-service.url=http://127.0.0.1:"+aiStub.getAddress().getPort(),
                        "--app.ai-service.timeout-seconds=1", "--spring.datasource.url=" + databaseUrl,
                        "--spring.datasource.username=" + username, "--spring.datasource.password=" + password,
                        "--spring.jpa.show-sql=false", "--logging.level.org.hibernate.SQL=OFF");
        baseUrl = "http://localhost:" + context.getEnvironment().getProperty("local.server.port");
        users = context.getBean(UserRepository.class);
        String hash = context.getBean(PasswordEncoder.class).encode("LoginTest123!");
        for (UserRole role : UserRole.values()) {
            users.saveAndFlush(User.builder().email(role.name().toLowerCase() + "@example.test")
                    .fullName("Người dùng " + role.name()).passwordHash(hash).role(role).build());
        }
        users.saveAndFlush(User.builder().email("inactive@example.test").fullName("Inactive")
                .passwordHash(hash).role(UserRole.CANDIDATE).status(UserStatus.INACTIVE).build());
    }

    @AfterAll
    void stopBackendAndRemoveTestDatabase() throws Exception {
        if (context != null) context.close();
        if(aiStub!=null)aiStub.stop(0);if(aiExecutor!=null)aiExecutor.shutdownNow();
        if (databaseName != null) {
            try (var admin = DriverManager.getConnection(System.getenv("LUMI_TEST_POSTGRES_URL"), username, password);
                 var statement = admin.createStatement()) {
                statement.execute("DROP DATABASE IF EXISTS " + databaseName);
            }
        }
    }

    @BeforeEach
    void newBrowserSession() {
        cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        client = HttpClient.newBuilder().cookieHandler(cookies).build();
    }

    @Test
    void loginPersistsSessionRotatesIdAndReturnsOnlyUserDto() throws Exception {
        assertEquals(401, get("/api/auth/me").statusCode());
        var token = csrf();
        String originalSession = sessionId();
        var response = post("/api/auth/login", Map.of("email", "  CANDIDATE@EXAMPLE.TEST  ", "password", "LoginTest123!"), token);
        assertEquals(200, response.statusCode(), response.body());
        JsonNode body = mapper.readTree(response.body());
        assertTrue(body.path("success").asBoolean());
        assertEquals("CANDIDATE", body.at("/data/user/role").asText());
        assertEquals("candidate@example.test", body.at("/data/user/email").asText());
        assertFalse(response.body().contains("password"));
        assertFalse(response.body().contains("accessToken"));
        assertNotEquals(originalSession, sessionId());
        String cookie = response.headers().firstValue("set-cookie").orElseThrow();
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Lax"));
        var me = get("/api/auth/me");
        assertEquals(200, me.statusCode());
        assertEquals(body.at("/data/user/id").asText(), mapper.readTree(me.body()).at("/data/id").asText());
    }

    private java.util.HashMap<String,Object> reviewResume() {
        var cv = new java.util.HashMap<String,Object>();
        cv.put("desiredPosition", "Backend Intern"); cv.put("summary", ""); cv.put("skills", java.util.List.of("Java"));
        for (String field : java.util.List.of("experiences","educations","certifications","languages","awards","activities")) cv.put(field, java.util.List.of());
        cv.put("projects", java.util.List.of(Map.of("name","Library", "description","Làm website bằng Java.")));
        return cv;
    }
    @Test void cvReviewRequiresCandidateCsrfAndDoesNotPersistOrTransmitContactInfo() throws Exception {
        String path = "/api/candidate/cv-review";
        var cv = reviewResume(); cv.put("email","private@example.test"); cv.put("fullName","Private Name");
        var body = new java.util.HashMap<String,Object>(); body.put("resume", cv);
        int before = reviewCalls.get();
        assertEquals(401, post(path,body,csrf()).statusCode());
        loginStaff("recruiter"); assertEquals(403,post(path,body,csrf()).statusCode());
        loginStaff("candidate"); assertEquals(403,post(path,body,null).statusCode());
        cv.put("skills",java.util.Collections.nCopies(101,"Java"));assertEquals(400,post(path,body,csrf()).statusCode());
        cv.put("skills",java.util.List.of("Java")); assertEquals(before,reviewCalls.get());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        long count=jdbc.queryForObject("select count(*) from candidate.resumes",Long.class);
        var response=post(path,body,csrf());assertEquals(200,response.statusCode(),response.body());
        assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
        assertEquals(0,mapper.readTree(response.body()).at("/data/items/0/index").asInt());
        assertTrue(lastReviewRequest.path("job").isNull());
        assertFalse(lastReviewRequest.path("resume").has("email")); assertFalse(lastReviewRequest.path("resume").has("fullName"));
        assertEquals(count,jdbc.queryForObject("select count(*) from candidate.resumes",Long.class));
    }
    @Test void cvReviewUsesPublishedServerJobAndRefinesOnlyExistingTargets() throws Exception {
        String job=applicationJob();var body=new java.util.HashMap<String,Object>();body.put("resume",reviewResume());body.put("jobId",job);
        var response=post("/api/candidate/cv-review",body,csrf());assertEquals(200,response.statusCode(),response.body());
        assertEquals("Understand Java",lastReviewRequest.at("/job/requirements").asText());
        body.put("target",Map.of("section","project","index",0));body.put("answer","Tôi viết API mượn trả bằng Java, nhóm 3 người.");
        response=post("/api/candidate/cv-review/refine",body,csrf());assertEquals(200,response.statusCode(),response.body());
        assertTrue(mapper.readTree(response.body()).at("/data/suggestion").asText().contains("3 người"));
        int before=reviewCalls.get();body.put("target",Map.of("section","project","index",29));
        assertEquals(400,post("/api/candidate/cv-review/refine",body,csrf()).statusCode());assertEquals(before,reviewCalls.get());
        body.remove("target");body.remove("answer");body.put("jobId",UUID.randomUUID().toString());
        assertEquals(404,post("/api/candidate/cv-review",body,csrf()).statusCode());assertEquals(before,reviewCalls.get());
    }
    @Test void cvReviewFailuresInvalidEvidenceAndInventedNumbersKeepCvUnchangedAndRecover() throws Exception {
        loginStaff("candidate");var body=new java.util.HashMap<String,Object>();body.put("resume",reviewResume());
        try {
            for(String mode:java.util.List.of("unavailable","slow","badIndex","badEvidence")) {
                reviewMode=mode;assertEquals(503,post("/api/candidate/cv-review",body,csrf()).statusCode(),mode);
            }
            body.put("target",Map.of("section","project","index",0));body.put("answer","Viết API trong nhóm 3 người.");reviewMode="invented";
            assertEquals(503,post("/api/candidate/cv-review/refine",body,csrf()).statusCode());
            reviewMode="coaching";assertEquals(503,post("/api/candidate/cv-review/refine",body,csrf()).statusCode());
            reviewMode="ok";assertEquals(200,post("/api/candidate/cv-review/refine",body,csrf()).statusCode());
        } finally {reviewMode="ok";}
    }

    @Test
    void cvWritingRequiresCandidateCsrfAndBoundedInputsWithoutSavingCv() throws Exception {
        String path = "/api/candidate/cv-writing";
        var input = new java.util.HashMap<String, Object>(Map.of("section", "project", "action", "polish",
            "text", "Làm giỏ hàng React.", "context", "Dự án môn học"));
        int beforeCalls = writingCalls.get();
        assertEquals(401, post(path, input, csrf()).statusCode());
        loginStaff("recruiter");
        assertEquals(403, post(path, input, csrf()).statusCode());
        loginStaff("candidate");
        assertEquals(403, post(path, input, null).statusCode());
        input.put("text", " "); assertEquals(400, post(path, input, csrf()).statusCode());
        input.put("text", "x".repeat(6001)); assertEquals(400, post(path, input, csrf()).statusCode());
        input.put("text", "Làm giỏ hàng React."); input.put("section", "education");
        assertEquals(400, post(path, input, csrf()).statusCode());
        assertEquals(beforeCalls, writingCalls.get());
        input.put("section", "project");
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        long beforeResumes = jdbc.queryForObject("select count(*) from candidate.resumes", Long.class);
        var response = post(path, input, csrf());
        assertEquals(200, response.statusCode(), response.body());
        assertEquals("Tham gia phát triển giỏ hàng bằng React.", mapper.readTree(response.body()).at("/data/suggestion").asText());
        assertTrue(response.headers().firstValue("cache-control").orElse("").contains("no-store"));
        assertEquals(beforeResumes, jdbc.queryForObject("select count(*) from candidate.resumes", Long.class));
    }

    @Test
    void cvWritingProviderFailureTimeoutAndInvalidClaimsAreRecoverable() throws Exception {
        loginStaff("candidate");
        var input = Map.of("section", "project", "action", "polish", "text", "Làm giỏ hàng React.");
        try {
            for (String mode : java.util.List.of("unavailable", "slow", "invented")) {
                writingMode = mode;
                assertEquals(503, post("/api/candidate/cv-writing", input, csrf()).statusCode());
            }
            writingMode = "ok";
            assertEquals(200, post("/api/candidate/cv-writing", input, csrf()).statusCode());
        } finally { writingMode = "ok"; }
    }

    @Test
    void rejectsWrongUnknownAndInactiveAccountsWithoutAuthenticating() throws Exception {
        for (String email : new String[]{"candidate@example.test", "missing@example.test", "inactive@example.test"}) {
            String secret = email.startsWith("candidate") ? "wrong-password" : "LoginTest123!";
            var response = post("/api/auth/login", Map.of("email", email, "password", secret), csrf());
            assertEquals(401, response.statusCode(), response.body());
            assertFalse(mapper.readTree(response.body()).path("success").asBoolean());
            assertEquals(401, get("/api/auth/me").statusCode());
        }
        assertEquals(401, post("/api/auth/login", Map.of("email", "candidate@example.test", "password", "á".repeat(50)), csrf()).statusCode());
    }

    @Test
    void validatesDtoAndMalformedJson() throws Exception {
        var response = post("/api/auth/login", Map.of("email", "invalid", "password", ""), csrf());
        assertEquals(400, response.statusCode());
        assertEquals(2, mapper.readTree(response.body()).path("errors").size());
        var token = csrf();
        var malformed = client.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/auth/login"))
                .header("Content-Type", "application/json").header(token.header(), token.value())
                .POST(HttpRequest.BodyPublishers.ofString("{broken")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(400, malformed.statusCode());
    }

    @Test
    void csrfProtectsLoginAndLogoutAndOldSessionCannotBeReused() throws Exception {
        Map<String, String> request = Map.of("email", "candidate@example.test", "password", "LoginTest123!");
        assertEquals(403, post("/api/auth/login", request, null).statusCode());
        var beforeLoginToken = csrf();
        assertEquals(200, post("/api/auth/login", request, beforeLoginToken).statusCode());
        String authenticatedSession = sessionId();
        assertEquals(403, post("/api/auth/logout", Map.of(), beforeLoginToken).statusCode());
        assertEquals(403, post("/api/auth/logout", Map.of(), null).statusCode());
        assertEquals(200, get("/api/auth/me").statusCode());
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
        var replay = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/auth/me"))
                .header("Cookie", "JSESSIONID=" + authenticatedSession).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, replay.statusCode());
        assertEquals(200, post("/api/auth/login", request, csrf()).statusCode());
    }

    @Test
    void serverEnforcesRolesForCandidateRecruiterAndAdmin() throws Exception {
        assertEquals(401, get("/api/recruiter/test-access").statusCode());
        for (UserRole role : UserRole.values()) {
            assertEquals(200, post("/api/auth/login", Map.of("email", role.name().toLowerCase() + "@example.test", "password", "LoginTest123!"), csrf()).statusCode());
            assertEquals(role == UserRole.CANDIDATE ? 403 : 200, get("/api/recruiter/test-access").statusCode());
            assertEquals(role == UserRole.CANDIDATE ? 200 : 403, get("/api/candidate/test-access").statusCode());
            assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        }
    }

    @Test
    void deactivatedAccountLosesCurrentSession() throws Exception {
        assertEquals(200, post("/api/auth/login", Map.of("email", "candidate@example.test", "password", "LoginTest123!"), csrf()).statusCode());
        User candidate = users.findByEmail("candidate@example.test").orElseThrow();
        try {
            candidate.setStatus(UserStatus.INACTIVE);
            users.saveAndFlush(candidate);
            assertEquals(401, get("/api/auth/me").statusCode());
            assertEquals(401, get("/api/candidate/test-access").statusCode());
        } finally {
            candidate.setStatus(UserStatus.ACTIVE);
            users.saveAndFlush(candidate);
        }
    }

    @Test
    void registrationCreatesProfileAndAuthenticatedSession() throws Exception {
        String email = "new-" + UUID.randomUUID() + "@example.test";
        var token = csrf();
        String originalSession = sessionId();
        var registration = post("/api/auth/register", Map.of("email", "  " + email.toUpperCase() + "  ",
                "password", "LoginTest123!", "fullName", "  Ứng viên mới  ", "role", "COMPANY_ADMIN"), token);
        assertEquals(201, registration.statusCode(), registration.body());
        assertNotEquals(originalSession, sessionId());
        var me = get("/api/auth/me");
        assertEquals(200, me.statusCode(), me.body());
        var account = mapper.readTree(me.body()).path("data");
        assertEquals(email, account.path("email").asText());
        assertEquals("Ứng viên mới", account.path("fullName").asText());
        assertEquals("CANDIDATE", account.path("role").asText());
        assertFalse(registration.body().contains("password"));
        var profiles = context.getBean(com.lumi.recruitment.repository.CandidateProfileRepository.class);
        assertTrue(profiles.existsById(UUID.fromString(account.path("id").asText())));
        assertTrue(context.getBean(PasswordEncoder.class).matches("LoginTest123!", users.findByEmail(email).orElseThrow().getPasswordHash()));
        assertEquals(403, post("/api/auth/logout", Map.of(), token).statusCode());
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
        var login = post("/api/auth/login", Map.of("email", email, "password", "LoginTest123!"), csrf());
        assertEquals(200, login.statusCode(), login.body());
        assertEquals("CANDIDATE", mapper.readTree(login.body()).at("/data/user/role").asText());
    }

    @Test
    void registrationRejectsDuplicateEmailAndInvalidInputWithoutCreatingAccounts() throws Exception {
        long before = users.count();
        var duplicate = post("/api/auth/register", Map.of("email", " CANDIDATE@EXAMPLE.TEST ",
                "password", "LoginTest123!", "fullName", "Duplicate"), csrf());
        assertEquals(409, duplicate.statusCode(), duplicate.body());
        assertEquals(401, get("/api/auth/me").statusCode());
        for (var input : java.util.List.of(
                Map.of("email", "valid@example.test", "password", "LoginTest123!", "fullName", "   "),
                Map.of("email", "invalid", "password", "LoginTest123!", "fullName", "Test"),
                Map.of("email", "valid@example.test", "password", "short", "fullName", "Test"),
                Map.of("email", "valid@example.test", "password", "á".repeat(37), "fullName", "Test"))) {
            var invalid = post("/api/auth/register", input, csrf());
            assertEquals(400, invalid.statusCode(), invalid.body());
            assertTrue(mapper.readTree(invalid.body()).path("errors").size() > 0);
        }
        assertEquals(403, post("/api/auth/register", Map.of("email", "csrf@example.test",
                "password", "LoginTest123!", "fullName", "Test"), null).statusCode());
        assertEquals(before, users.count());
    }

    @Test
    void acceptsConfiguredCorsOriginAndRejectsOtherOrigins() throws Exception {
        for (String origin : new String[]{"http://localhost:5173", "https://untrusted.example"}) {
            var response = client.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/auth/login"))
                    .header("Origin", origin).header("Access-Control-Request-Method", "POST")
                    .header("Access-Control-Request-Headers", "content-type,x-csrf-token")
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(origin.contains("localhost") ? 200 : 403, response.statusCode());
        }
    }

    @Test
    void onboardingPersistsProgressCompletionSkipAndProfileEdits() throws Exception {
        String email = "onboarding-" + UUID.randomUUID() + "@example.test";
        assertEquals(201, post("/api/auth/register", Map.of("email", email, "password", "LoginTest123!", "fullName", "Before"), csrf()).statusCode());
        assertEquals("NOT_STARTED", mapper.readTree(get("/api/auth/me").body()).at("/data/onboardingStatus").asText());
        var input = Map.of("fullName", "  After  ", "phone", "+84 901 234 567", "location", "Đà Nẵng",
                "skills", "Java,React", "experienceYears", "2.5", "desiredPosition", "Backend Developer");
        assertEquals(403, post("/api/candidate/onboarding/steps/0", input, null).statusCode());
        var first = post("/api/candidate/onboarding/steps/0", input, csrf());
        assertEquals(200, first.statusCode(), first.body());
        assertEquals("IN_PROGRESS", mapper.readTree(first.body()).at("/data/onboardingStatus").asText());
        assertEquals(1, mapper.readTree(get("/api/candidate/profile").body()).at("/data/onboardingStep").asInt());
        assertEquals("After", mapper.readTree(get("/api/auth/me").body()).at("/data/fullName").asText());
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        assertEquals(200, post("/api/auth/login", Map.of("email", email, "password", "LoginTest123!"), csrf()).statusCode());
        assertEquals("IN_PROGRESS", mapper.readTree(get("/api/auth/me").body()).at("/data/onboardingStatus").asText());
        assertEquals(200, post("/api/candidate/onboarding/skip", Map.of(), csrf()).statusCode());
        var skipped = mapper.readTree(get("/api/candidate/profile").body()).path("data");
        assertEquals("SKIPPED", skipped.path("onboardingStatus").asText());
        assertEquals("Đà Nẵng", skipped.path("location").asText());
        assertEquals(200, post("/api/candidate/onboarding/steps/1", input, csrf()).statusCode());
        assertEquals(200, post("/api/candidate/onboarding/steps/2", input, csrf()).statusCode());
        assertEquals("COMPLETED", mapper.readTree(get("/api/auth/me").body()).at("/data/onboardingStatus").asText());
        var changed = new java.util.HashMap<>(input);
        changed.put("location", "Hà Nội");
        var token = csrf();
        var edited = client.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/candidate/profile"))
                .header("Content-Type", "application/json").header(token.header(), token.value())
                .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(changed))).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, edited.statusCode(), edited.body());
        var persisted = mapper.readTree(get("/api/candidate/profile").body()).path("data");
        assertEquals("Hà Nội", persisted.path("location").asText());
        assertEquals("COMPLETED", persisted.path("onboardingStatus").asText());
        var profile = context.getBean(com.lumi.recruitment.repository.CandidateProfileRepository.class)
                .findById(users.findByEmail(email).orElseThrow().getId()).orElseThrow();
        assertEquals("Hà Nội", profile.getLocation());
        assertEquals("Java,React", profile.getSkills());
        assertEquals(new java.math.BigDecimal("2.5"), profile.getExperienceYears());
    }

    @Test
    void surveyPreferencesPersistAndUnsupportedChoicesRollBack() throws Exception {
        String email = "preferences-" + UUID.randomUUID() + "@example.test";
        assertEquals(201, post("/api/auth/register", Map.of("email", email, "password", "LoginTest123!", "fullName", "Owner"), csrf()).statusCode());
        var initial = mapper.readTree(get("/api/candidate/profile").body()).path("data");
        assertTrue(initial.path("experienceYears").isNull());
        assertTrue(initial.path("experienceRange").isNull());
        assertEquals(0, initial.path("employmentTypes").size());
        assertEquals(200, get("/api/candidate/profile/options").statusCode());
        var input = new java.util.HashMap<String, Object>();
        input.put("fullName", "Owner");
        input.put("positionUndecided", true);
        input.put("desiredPosition", "Must be cleared");
        input.put("employmentTypes", java.util.List.of("FULL_TIME", "FULL_TIME"));
        var first = post("/api/candidate/onboarding/steps/0", input, csrf());
        assertEquals(200, first.statusCode(), first.body());
        assertTrue(mapper.readTree(first.body()).at("/data/desiredPosition").isNull());
        assertEquals(1, mapper.readTree(first.body()).at("/data/employmentTypes").size());
        input.put("experienceRange", "NONE");
        input.put("skills", "Java,Docker");
        assertEquals(200, post("/api/candidate/onboarding/steps/1", input, csrf()).statusCode());
        input.put("workModes", java.util.List.of("HYBRID", "REMOTE"));
        input.put("preferredLocations", java.util.List.of("Đà Nẵng"));
        assertEquals(200, post("/api/candidate/onboarding/steps/2", input, csrf()).statusCode());
        var stored = context.getBean(com.lumi.recruitment.repository.CandidateProfileRepository.class)
                .findById(users.findByEmail(email).orElseThrow().getId()).orElseThrow();
        assertEquals("NONE", stored.getExperienceRange());
        assertNull(stored.getExperienceYears());
        assertEquals(java.util.List.of("HYBRID", "REMOTE"), stored.getWorkModes());
        assertEquals("Java,Docker", stored.getSkills());
        input.put("fullName", "Must roll back");
        input.put("employmentTypes", java.util.List.of("PART_TIME"));
        assertEquals(400, post("/api/candidate/onboarding/steps/0", input, csrf()).statusCode());
        assertEquals("Owner", users.findByEmail(email).orElseThrow().getFullName());
        input.put("employmentTypes", java.util.List.of("INVALID"));
        assertEquals(400, post("/api/candidate/onboarding/steps/0", input, csrf()).statusCode());
        input.put("employmentTypes", java.util.List.of("FULL_TIME"));
        input.put("preferredLocations", java.util.List.of("Unsupported office"));
        assertEquals(400, post("/api/candidate/onboarding/steps/0", input, csrf()).statusCode());
        assertEquals("COMPLETED", mapper.readTree(get("/api/candidate/profile").body()).at("/data/onboardingStatus").asText());
    }

    @Test
    void onboardingValidatesInputsAndCannotEditAnotherUser() throws Exception {
        assertEquals(401, get("/api/candidate/profile").statusCode());
        String email = "validation-" + UUID.randomUUID() + "@example.test";
        assertEquals(201, post("/api/auth/register", Map.of("email", email, "password", "LoginTest123!", "fullName", "Owner"), csrf()).statusCode());
        for (var invalid : java.util.List.of(Map.of("fullName", "  "), Map.of("fullName", "Test", "phone", "abc"),
                Map.of("fullName", "Test", "experienceYears", "-1"), Map.of("fullName", "Test", "experienceYears", "2.55"),
                Map.of("fullName", "Test", "location", "x".repeat(256)))) {
            assertEquals(400, post("/api/candidate/onboarding/steps/0", invalid, csrf()).statusCode());
        }
        assertEquals(400, post("/api/candidate/onboarding/steps/3", Map.of("fullName", "Test"), csrf()).statusCode());
        assertEquals("Owner", users.findByEmail(email).orElseThrow().getFullName());
        var other = users.findByEmail("candidate@example.test").orElseThrow();
        String otherName = other.getFullName();
        var forged = post("/api/candidate/onboarding/steps/0", Map.of("fullName", "Only owner", "userId", other.getId().toString(),
                "role", "COMPANY_ADMIN", "onboardingStatus", "COMPLETED"), csrf());
        assertEquals(200, forged.statusCode(), forged.body());
        assertEquals(otherName, users.findById(other.getId()).orElseThrow().getFullName());
        assertEquals("Only owner", users.findByEmail(email).orElseThrow().getFullName());
        assertEquals("IN_PROGRESS", mapper.readTree(get("/api/auth/me").body()).at("/data/onboardingStatus").asText());
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        assertEquals(200, post("/api/auth/login", Map.of("email", "recruiter@example.test", "password", "LoginTest123!"), csrf()).statusCode());
        assertEquals(403, get("/api/candidate/profile").statusCode());
        assertEquals(403, post("/api/candidate/onboarding/skip", Map.of(), csrf()).statusCode());
    }

    @Test
    void publicJobApiFiltersPaginatesAndHidesUnavailableJobs() throws Exception {
        var departments = context.getBean(com.lumi.recruitment.repository.DepartmentRepository.class);
        var jobs = context.getBean(com.lumi.recruitment.repository.JobRepository.class);
        String keyword = "jobtest" + UUID.randomUUID().toString().replace("-", "");
        var department = new com.lumi.recruitment.entity.recruitment.Department();
        department.setName(keyword);
        department = departments.saveAndFlush(department);
        var visible = jobFixture(department, keyword + " Alpha", "PUBLISHED");
        visible.setSalaryMin(new java.math.BigDecimal("20000000"));
        visible.setSalaryMax(new java.math.BigDecimal("30000000"));
        visible.setHeadcount(7);
        visible = jobs.saveAndFlush(visible);
        var skillRepository = context.getBean(com.lumi.recruitment.repository.SkillRepository.class);
        var jobSkillRepository = context.getBean(com.lumi.recruitment.repository.JobSkillRepository.class);
        String skillKeyword = "skilltest" + UUID.randomUUID().toString().replace("-", "");
        for (String name : java.util.List.of("Java", "SQL", skillKeyword + " A", skillKeyword + " B")) {
            var skill = skillRepository.findByNormalizedName(name.toLowerCase()).orElseGet(() -> {
                var created = new com.lumi.recruitment.entity.catalog.Skill(); created.setName(name);
                return skillRepository.saveAndFlush(created);
            });
            var link = new com.lumi.recruitment.entity.recruitment.JobSkill();
            link.setJob(visible); link.setSkill(skill);
            jobSkillRepository.saveAndFlush(link);
        }
        jobs.saveAndFlush(jobFixture(department, keyword + " Beta", "PUBLISHED"));
        var draft = jobs.saveAndFlush(jobFixture(department, keyword + " Draft", "DRAFT"));
        var closed = jobs.saveAndFlush(jobFixture(department, keyword + " Closed", "CLOSED"));
        var expired = jobFixture(department, keyword + " Expired", "PUBLISHED");
        expired.setApplicationDeadline(java.time.Instant.now().minusSeconds(60));
        expired = jobs.saveAndFlush(expired);
        var scheduled = jobFixture(department, keyword + " Scheduled", "PUBLISHED");
        scheduled.setPublishedAt(java.time.Instant.now().plusSeconds(3600));
        scheduled = jobs.saveAndFlush(scheduled);
        var inactive = new com.lumi.recruitment.entity.recruitment.Department();
        inactive.setName(keyword + " inactive"); inactive.setActive(false);
        inactive = departments.saveAndFlush(inactive);
        var inactiveJob = jobs.saveAndFlush(jobFixture(inactive, keyword + " Inactive", "PUBLISHED"));

        var result = get("/api/jobs?keyword=" + keyword + "&size=1&sort=salary");
        assertEquals(200, result.statusCode(), result.body());
        var data = mapper.readTree(result.body()).path("data");
        assertEquals(2, data.path("totalElements").asInt());
        assertEquals(2, data.path("totalPages").asInt());
        assertEquals(visible.getId().toString(), data.at("/content/0/id").asText());
        assertEquals(7, data.at("/content/0/headcount").asInt());
        var next = mapper.readTree(get("/api/jobs?keyword="+keyword+"&size=1&sort=salary&page=1").body()).path("data");
        assertNotEquals(data.at("/content/0/id").asText(),next.at("/content/0/id").asText());
        assertTrue(next.path("last").asBoolean());
        var filtered = get("/api/jobs?keyword="+keyword+"&departmentId="+department.getId()+"&level=JUNIOR&workMode=HYBRID&minSalary=15000000");
        assertEquals(1, mapper.readTree(filtered.body()).at("/data/totalElements").asInt(), filtered.body());
        assertEquals(0,mapper.readTree(get("/api/jobs?keyword="+keyword+"&level=SENIOR").body()).at("/data/totalElements").asInt());
        assertEquals(1,mapper.readTree(get("/api/jobs?ids="+visible.getId()).body()).at("/data/totalElements").asInt());
        assertEquals(0,mapper.readTree(get("/api/jobs?keyword=%25").body()).at("/data/totalElements").asInt());
        var detail=get("/api/jobs/"+visible.getId());
        assertEquals(200,detail.statusCode(),detail.body());
        assertEquals("Java and SQL",mapper.readTree(detail.body()).at("/data/requirements").asText());
        assertEquals(4,mapper.readTree(detail.body()).at("/data/skills").size());
        assertEquals(7,mapper.readTree(detail.body()).at("/data/headcount").asInt());
        var skillOnly = mapper.readTree(get("/api/jobs?keyword=" + skillKeyword + "&size=1").body()).path("data");
        assertEquals(1,skillOnly.path("totalElements").asInt());
        assertEquals(1,skillOnly.path("totalPages").asInt());
        assertEquals(visible.getId().toString(),skillOnly.at("/content/0/id").asText());
        assertFalse(detail.body().contains("password"));
        assertFalse(detail.body().contains("createdBy"));
        for(var hidden:java.util.List.of(draft,closed,expired,scheduled,inactiveJob)) {
            assertEquals(404,get("/api/jobs/"+hidden.getId()).statusCode());
        }
        assertEquals(404,get("/api/jobs/"+UUID.randomUUID()).statusCode());
        var departmentResponse=get("/api/departments");
        assertEquals(200,departmentResponse.statusCode());
        assertFalse(departmentResponse.body().contains(inactive.getId().toString()));
        assertTrue(departmentResponse.body().contains(department.getId().toString()));
        for(String query:java.util.List.of("page=-1","size=101","size=0","sort=bad","level=bad","departmentId=bad","minSalary=-1")) {
            assertEquals(400,get("/api/jobs?"+query).statusCode(),query);
        }
        assertEquals(400,get("/api/jobs/not-a-uuid").statusCode());
        assertEquals(401,post("/api/jobs",Map.of(),csrf()).statusCode());
        visible.setStatus("CLOSED"); jobs.saveAndFlush(visible);
        assertEquals(404,get("/api/jobs/"+visible.getId()).statusCode());
    }

    private com.lumi.recruitment.entity.recruitment.Job jobFixture(
            com.lumi.recruitment.entity.recruitment.Department department,String title,String status) {
        var job=new com.lumi.recruitment.entity.recruitment.Job();
        job.setDepartment(department);job.setCreatedBy(users.findByEmail("recruiter@example.test").orElseThrow());
        job.setTitle(title);job.setDescription("Build useful products");job.setRequirements("Java and SQL");
        job.setBenefits("Learning budget");job.setSkills("Java,SQL");job.setLocation("Đà Nẵng");
        job.setEmploymentType("FULL_TIME");job.setWorkMode("HYBRID");job.setExperienceLevel("JUNIOR");
        job.setCurrency("VND");job.setStatus(status);job.setPublishedAt(java.time.Instant.now().minusSeconds(3600));
        job.setCreatedAt(java.time.Instant.now());job.setUpdatedAt(java.time.Instant.now());
        return job;
    }


    @Test
    void resumesPersistStructuredSectionsAndStayIndependentOfProfile() throws Exception {
        registerResumeOwner();
        String profileBefore = get("/api/candidate/profile").body();
        var first = resumePayload("CV Java", "DRAFT");
        first.put("candidateId", UUID.randomUUID().toString()); // owner cannot be forged
        var created = sendResume("POST", "/api/candidate/resumes", first, true);
        assertEquals(201, created.statusCode(), created.body());
        var data = mapper.readTree(created.body()).path("data");
        String id = data.path("id").asText();
        assertEquals(mapper.readTree(get("/api/auth/me").body()).at("/data/id").asText(), data.path("candidateId").asText());
        assertFalse(created.body().contains("password"));
        assertEquals(2, data.path("skills").size());
        assertEquals("Lumi", data.at("/experiences/0/company").asText());
        assertEquals("2024-01", data.at("/experiences/0/startDate").asText());
        assertEquals("Đại học", data.at("/educations/0/school").asText());
        assertEquals("Hiring", data.at("/projects/0/name").asText());
        assertEquals("Java", data.at("/certifications/0/name").asText());
        assertEquals("Tiếng Anh", data.at("/languages/0/name").asText());
        assertEquals("B2", data.at("/languages/0/proficiency").asText());
        assertEquals("Hackathon", data.at("/awards/0/title").asText());
        assertEquals("Coding club", data.at("/activities/0/name").asText());
        var repository = context.getBean(com.lumi.recruitment.repository.ResumeRepository.class);
        assertEquals("Lumi", repository.findById(UUID.fromString(id)).orElseThrow().getExperiences().getFirst().company());
        var stored = repository.findById(UUID.fromString(id)).orElseThrow();
        assertEquals("IELTS 6.5", stored.getLanguages().getFirst().certification());
        assertEquals("2025-09", stored.getAwards().getFirst().awardedDate());
        assertTrue(stored.getActivities().getFirst().current());
        assertEquals(201, sendResume("POST", "/api/candidate/resumes", resumePayload("CV khác", "DRAFT"), true).statusCode());
        assertEquals(2, mapper.readTree(get("/api/candidate/resumes").body()).path("data").size());
        first.put("title", "CV Java đã sửa"); first.put("version", data.path("version").asLong());
        var saved = sendResume("PUT", "/api/candidate/resumes/" + id, first, true);
        assertEquals(200, saved.statusCode(), saved.body());
        assertEquals("CV Java đã sửa", mapper.readTree(get("/api/candidate/resumes/" + id).body()).at("/data/title").asText());
        var before = mapper.readTree(profileBefore).path("data");
        var after = mapper.readTree(get("/api/candidate/profile").body()).path("data");
        assertEquals(before, after);
        assertEquals(409, sendResume("PUT", "/api/candidate/resumes/" + id, first, true).statusCode());
        assertEquals(409, sendResume("DELETE", "/api/candidate/resumes/" + id + "?version=0", Map.of(), true).statusCode());
        long version = mapper.readTree(saved.body()).at("/data/version").asLong();
        assertEquals(200, sendResume("DELETE", "/api/candidate/resumes/" + id + "?version=" + version, Map.of(), true).statusCode());
        assertEquals(404, get("/api/candidate/resumes/" + id).statusCode());
    }

    @Test
    void resumeOwnershipRoleAndCsrfAreEnforced() throws Exception {
        assertEquals(401, get("/api/candidate/resumes").statusCode());
        registerResumeOwner();
        var payload = resumePayload("Private CV", "READY");
        assertEquals(403, sendResume("POST", "/api/candidate/resumes", payload, false).statusCode());
        var data = mapper.readTree(sendResume("POST", "/api/candidate/resumes", payload, true).body()).path("data");
        String id = data.path("id").asText();
        payload.put("version", data.path("version").asLong());
        assertEquals(403, sendResume("PUT", "/api/candidate/resumes/" + id, payload, false).statusCode());
        assertEquals(403, sendResume("PUT", "/api/candidate/resumes/" + id + "/default", Map.of("version", 0), false).statusCode());
        assertEquals(403, sendResume("DELETE", "/api/candidate/resumes/" + id + "?version=0", Map.of(), false).statusCode());
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        registerResumeOwner();
        assertEquals(0, mapper.readTree(get("/api/candidate/resumes").body()).path("data").size());
        assertEquals(404, get("/api/candidate/resumes/" + id).statusCode());
        assertEquals(404, sendResume("PUT", "/api/candidate/resumes/" + id, payload, true).statusCode());
        assertEquals(404, sendResume("PUT", "/api/candidate/resumes/" + id + "/default", Map.of("version", 0), true).statusCode());
        assertEquals(404, sendResume("DELETE", "/api/candidate/resumes/" + id + "?version=0", Map.of(), true).statusCode());
        assertEquals(200, post("/api/auth/login", Map.of("email", "recruiter@example.test", "password", "LoginTest123!"), csrf()).statusCode());
        assertEquals(403, get("/api/candidate/resumes").statusCode());
        assertEquals(403, sendResume("POST", "/api/candidate/resumes", payload, true).statusCode());
    }

    @Test
    void enrichedResumeFieldsPersistAndValidateWithoutChangingLegacyData() throws Exception {
        registerResumeOwner();
        var body = resumePayload("Enriched CV", "DRAFT");
        body.put("skills", java.util.List.of("Java", "java", " Spring   Boot ", "spring boot"));
        body.put("educations", java.util.List.of(Map.of("school", "University", "gpa", 3.65, "gpaScale", 4)));
        body.put("projects", java.util.List.of(Map.of("name", "API project", "startDate", "2025-01", "endDate", "", "current", true,
            "technologies", java.util.List.of("Java", "java", "PostgreSQL"), "description", "Developed an API")));
        var created = sendResume("POST", "/api/candidate/resumes", body, true);
        assertEquals(201, created.statusCode(), created.body());
        var first = mapper.readTree(created.body()).path("data");
        String path = "/api/candidate/resumes/" + first.path("id").asText();
        var stored = mapper.readTree(get(path).body()).path("data");
        assertEquals(2, stored.path("skills").size());
        assertEquals("Spring Boot", stored.at("/skills/1").asText());
        assertEquals(3.65, stored.at("/educations/0/gpa").asDouble());
        assertEquals(4, stored.at("/educations/0/gpaScale").asInt());
        assertEquals(2, stored.at("/projects/0/technologies").size());
        assertTrue(stored.at("/projects/0/current").asBoolean());
        assertEquals("2025-01", stored.at("/projects/0/startDate").asText());
        body.put("version", stored.path("version").asLong());
        body.put("status", "READY");
        assertEquals(200, sendResume("PUT", path, body, true).statusCode());
        stored = mapper.readTree(get(path).body()).path("data");
        assertEquals(first.path("projects"), stored.path("projects"));
        assertEquals(first.path("educations"), stored.path("educations"));
        body.put("version", stored.path("version").asLong());
        body.put("educations", java.util.List.of(Map.of("school", "University", "gpa", 5, "gpaScale", 4)));
        assertEquals(400, sendResume("PUT", path, body, true).statusCode());
        assertEquals(stored, mapper.readTree(get(path).body()).path("data"));
        body.put("educations", java.util.List.of(Map.of("school", "Legacy school")));
        body.put("projects", java.util.List.of(Map.of("name", "Legacy project", "description", "Original description")));
        assertEquals(200, sendResume("PUT", path, body, true).statusCode());
        var legacy = mapper.readTree(get(path).body()).path("data");
        assertEquals("Original description", legacy.at("/projects/0/description").asText());
    }

    @Test
    void resumesValidateNestedSectionsAndPermitIncompleteDrafts() throws Exception {
        registerResumeOwner();
        var draft = resumePayload("Empty draft", "DRAFT");
        draft.put("fullName", ""); draft.put("email", ""); draft.put("desiredPosition", "");
        assertEquals(201, sendResume("POST", "/api/candidate/resumes", draft, true).statusCode());
        draft.put("status", "READY");
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", draft, true).statusCode());
        var invalid = resumePayload("Invalid", "DRAFT"); invalid.put("githubUrl", "javascript:alert(1)");
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", invalid, true).statusCode());
        invalid.put("githubUrl", "https://github.com/test");
        invalid.put("experiences", java.util.List.of(Map.of("company", "Lumi", "startDate", "2024-01", "endDate", "2023-01")));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", invalid, true).statusCode());
        invalid.put("experiences", java.util.List.of(Map.of("company", "x".repeat(256))));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", invalid, true).statusCode());
        invalid.put("experiences", java.util.List.of(Map.of("startDate", "2024-13")));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", invalid, true).statusCode());
        assertEquals(400, get("/api/candidate/resumes/not-a-uuid").statusCode());
    }

    @Test
    void onlyOneDefaultCvSurvivesConcurrentRequestsAndDraftingClearsDefault() throws Exception {
        registerResumeOwner();
        var one = mapper.readTree(sendResume("POST", "/api/candidate/resumes", resumePayload("One", "READY"), true).body()).path("data");
        var two = mapper.readTree(sendResume("POST", "/api/candidate/resumes", resumePayload("Two", "READY"), true).body()).path("data");
        var token = csrf();
        var requests = java.util.List.of(one, two).stream().map(cv -> HttpRequest.newBuilder(URI.create(baseUrl + "/api/candidate/resumes/" + cv.path("id").asText() + "/default"))
                .header("Content-Type", "application/json").header(token.header(), token.value())
                .PUT(HttpRequest.BodyPublishers.ofString("{\"version\":0}")).build()).toList();
        var future1 = client.sendAsync(requests.get(0), HttpResponse.BodyHandlers.ofString());
        var future2 = client.sendAsync(requests.get(1), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, future1.get().statusCode()); assertEquals(200, future2.get().statusCode());
        var all = mapper.readTree(get("/api/candidate/resumes").body()).path("data");
        int defaults = 0; JsonNode selected = null;
        for (var cv : all) if (cv.path("isDefault").asBoolean()) { defaults++; selected = cv; }
        assertEquals(1, defaults);
        var draft = resumePayload("Back to draft", "DRAFT"); draft.put("version", selected.path("version").asLong());
        var response = sendResume("PUT", "/api/candidate/resumes/" + selected.path("id").asText(), draft, true);
        assertEquals(200, response.statusCode(), response.body());
        assertFalse(mapper.readTree(response.body()).at("/data/isDefault").asBoolean());
        var data = mapper.readTree(response.body()).path("data");
        assertEquals(400, sendResume("PUT", "/api/candidate/resumes/" + data.path("id").asText() + "/default", Map.of("version", data.path("version").asLong()), true).statusCode());
    }

    @Test
    void optionalResumeSectionsSurviveOlderClientsAndCanBeClearedExplicitly() throws Exception {
        registerResumeOwner();
        var body = resumePayload("Optional sections", "DRAFT");
        var created = sendResume("POST", "/api/candidate/resumes", body, true);
        assertEquals(201, created.statusCode(), created.body());
        var initial = mapper.readTree(created.body()).path("data");
        String path = "/api/candidate/resumes/" + initial.path("id").asText();
        body.remove("languages"); body.remove("awards"); body.remove("activities");
        body.put("version", initial.path("version").asLong());
        body.put("title", "Edited by older client");
        var updated = sendResume("PUT", path, body, true);
        assertEquals(200, updated.statusCode(), updated.body());
        var data = mapper.readTree(get(path).body()).path("data");
        for (String section : java.util.List.of("languages", "awards", "activities"))
            assertEquals(initial.path(section), data.path(section));
        body.put("version", data.path("version").asLong());
        body.put("languages", java.util.List.of()); body.put("awards", java.util.List.of()); body.put("activities", java.util.List.of());
        var cleared = sendResume("PUT", path, body, true);
        assertEquals(200, cleared.statusCode(), cleared.body());
        data = mapper.readTree(get(path).body()).path("data");
        for (String section : java.util.List.of("languages", "awards", "activities")) assertEquals(0, data.path(section).size());
        body.remove("languages"); body.remove("awards"); body.remove("activities"); body.remove("version");
        var legacy = sendResume("POST", "/api/candidate/resumes", body, true);
        assertEquals(201, legacy.statusCode(), legacy.body());
        for (String section : java.util.List.of("languages", "awards", "activities"))
            assertEquals(0, mapper.readTree(legacy.body()).at("/data/" + section).size());
    }

    @Test
    void optionalResumeSectionsValidateNestedDatesAndLimitsWithoutSaving() throws Exception {
        registerResumeOwner();
        var body = resumePayload("Invalid sections", "DRAFT");
        body.put("languages", java.util.Collections.nCopies(31, Map.of("name", "English")));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        body.put("languages", java.util.Collections.singletonList(null));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        body.put("languages", java.util.List.of(Map.of("proficiency", "x".repeat(256))));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        body.put("languages", java.util.List.of()); body.put("awards", java.util.List.of(Map.of("awardedDate", "2026-13")));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        body.put("awards", java.util.List.of());
        body.put("activities", java.util.List.of(Map.of("startDate", "2026-01", "endDate", "2025-01")));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        body.put("activities", java.util.List.of(Map.of("startDate", "2025-01", "endDate", "2026-01", "current", true)));
        assertEquals(400, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
        assertEquals(0, mapper.readTree(get("/api/candidate/resumes").body()).path("data").size());
        body.put("activities", java.util.List.of(Map.of("startDate", "2025-01", "endDate", "", "current", true)));
        assertEquals(201, sendResume("POST", "/api/candidate/resumes", body, true).statusCode());
    }

    @Test
    void resumePositionOptionsUseActiveCatalogAndPermitCustomCvTitles() throws Exception {
        String path = "/api/candidate/resumes/position-options";
        // Catalog names are public; saved CV content remains candidate-owned.
        assertEquals(200, get(path).statusCode());
        loginStaff("recruiter");
        assertEquals(200, get(path).statusCode());
        newBrowserSession(); registerResumeOwner();
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        UUID first = UUID.randomUUID(), second = UUID.randomUUID(), hidden = UUID.randomUUID();
        String position = "Position " + UUID.randomUUID();
        jdbc.update("insert into recruitment.departments(id,name,is_active) values (?, ?, true), (?, ?, true), (?, ?, false)",
                first, "CV first " + first, second, "CV second " + second, hidden, "CV hidden " + hidden);
        try {
            jdbc.update("insert into recruitment.job_positions(department_id,name,is_active) values (?, ?, true), (?, ?, true), (?, ?, false), (?, ?, true)",
                    first, position, second, position, first, position + " inactive", hidden, position + " hidden");
            var response = get(path);
            assertEquals(200, response.statusCode(), response.body());
            var names = mapper.readTree(response.body()).path("data").valueStream().map(JsonNode::asText).toList();
            assertEquals(1L, names.stream().filter(position::equals).count());
            assertFalse(names.contains(position + " inactive"));
            assertFalse(names.contains(position + " hidden"));
            var body = resumePayload("Custom position", "READY");
            body.put("desiredPosition", "Creative Frontend Intern - personal title");
            var created = sendResume("POST", "/api/candidate/resumes", body, true);
            assertEquals(201, created.statusCode(), created.body());
            String id = mapper.readTree(created.body()).at("/data/id").asText();
            assertEquals(body.get("desiredPosition"), mapper.readTree(get("/api/candidate/resumes/" + id).body()).at("/data/desiredPosition").asText());
            jdbc.update("update recruitment.departments set is_active=false where id in (?, ?)", first, second);
            assertFalse(mapper.readTree(get(path).body()).path("data").valueStream().anyMatch(node -> node.asText().equals(position)));
        } finally {
            jdbc.update("delete from recruitment.job_positions where department_id in (?, ?, ?)", first, second, hidden);
            jdbc.update("delete from recruitment.departments where id in (?, ?, ?)", first, second, hidden);
        }
    }

    @Test
    void publicJobExposesCatalogPositionSeparatelyFromAdvertTitle() throws Exception {
        loginStaff("recruiter");
        UUID dept = jobDepartment();
        var input = jobPayload(dept);
        input.put("title", "Hiring Java engineers for our product team");
        input.put("applicationDeadline", null);
        var created = post("/api/recruiter/jobs", input, csrf());
        assertEquals(201, created.statusCode(), created.body());
        String id = mapper.readTree(created.body()).at("/data/id").asText();
        action(id, "publish", 0, 200);
        var detail = get("/api/jobs/" + id);
        assertEquals(200, detail.statusCode(), detail.body());
        assertEquals("Backend Developer", mapper.readTree(detail.body()).at("/data/positionName").asText());
        assertEquals(input.get("title"), mapper.readTree(detail.body()).at("/data/title").asText());
        var listing = get("/api/jobs?ids=" + id);
        assertEquals(200, listing.statusCode(), listing.body());
        assertEquals("Backend Developer", mapper.readTree(listing.body()).at("/data/content/0/positionName").asText());
    }

    @Test
    void recruiterCreatesPersistentPrivateDraftWithSkillsCriteriaAndHistory() throws Exception {
        loginStaff("recruiter");
        UUID department = jobDepartment();
        var input = jobPayload(department);
        input.put("title", "Draft " + UUID.randomUUID());
        var response = post("/api/recruiter/jobs", input, csrf());
        assertEquals(201, response.statusCode(), response.body());
        var saved = mapper.readTree(response.body()).path("data");
        String id = saved.path("id").asText();
        assertEquals("DRAFT", saved.path("status").asText());
        assertTrue(saved.path("publishedAt").isNull());
        assertEquals(3, saved.path("headcount").asInt());
        assertEquals(2, saved.path("skills").size());
        assertEquals(1, saved.path("criteria").size());
        assertEquals("CREATED", saved.at("/history/0/action").asText());
        assertEquals("Người dùng RECRUITER", saved.at("/history/0/actor").asText());
        assertEquals(25.5, saved.at("/criteria/0/weight").asDouble());
        assertEquals(java.time.Instant.parse("2026-10-29T16:59:59.999999Z"), java.time.Instant.parse(saved.path("applicationDeadline").asText()));
        var j = context.getBean(com.lumi.recruitment.repository.JobRepository.class).findById(UUID.fromString(id)).orElseThrow();
        assertEquals(users.findByEmail("recruiter@example.test").orElseThrow().getId(), j.getCreatedBy().getId());
        assertEquals(404, get("/api/jobs/" + id).statusCode());
        // A fresh authenticated session reads from storage rather than React/session state.
        assertEquals(200, post("/api/auth/logout", Map.of(), csrf()).statusCode());
        newBrowserSession(); loginStaff("company_admin");
        var read = get("/api/recruiter/jobs/" + id);
        assertEquals(200, read.statusCode(), read.body());
        var persisted = mapper.readTree(read.body()).path("data");
        for (String field : java.util.List.of("id", "title", "headcount", "skills", "criteria", "history", "createdAt", "updatedAt", "status", "version", "applicationDeadline"))
            assertEquals(saved.path(field), persisted.path(field), field);
        assertEquals(saved.path("salaryMin").asDouble(), persisted.path("salaryMin").asDouble());
        assertEquals(saved.path("salaryMax").asDouble(), persisted.path("salaryMax").asDouble());
        var list = get("/api/recruiter/jobs?status=DRAFT&departmentId=" + department + "&keyword=Draft&size=1");
        assertEquals(200, list.statusCode());
        assertEquals(id, mapper.readTree(list.body()).at("/data/content/0/id").asText());
        var bySkill = get("/api/recruiter/jobs?departmentId=" + department + "&keyword=java");
        assertEquals(1, mapper.readTree(bySkill.body()).at("/data/totalElements").asInt());
        assertEquals(0, mapper.readTree(get("/api/recruiter/jobs?departmentId=" + department + "&status=PUBLISHED").body()).at("/data/totalElements").asInt());
        assertEquals(400, get("/api/recruiter/jobs?status=INVALID").statusCode());
        assertEquals(400, get("/api/recruiter/jobs?size=101").statusCode());
        assertEquals(400, get("/api/recruiter/jobs?page=-1").statusCode());
        assertEquals(404, get("/api/recruiter/jobs/" + UUID.randomUUID()).statusCode());
    }

    @Test
    void recruiterWriteRequiresStaffSessionAndCsrf() throws Exception {
        var input = jobPayload(jobDepartment());
        assertEquals(401, get("/api/recruiter/jobs").statusCode());
        assertEquals(401, post("/api/recruiter/jobs", input, csrf()).statusCode());
        loginStaff("candidate");
        assertEquals(403, get("/api/recruiter/jobs").statusCode());
        assertEquals(403, post("/api/recruiter/jobs", input, csrf()).statusCode());
        assertEquals(403, post("/api/recruiter/departments", Map.of("name", "Denied"), csrf()).statusCode());
        post("/api/auth/logout", Map.of(), csrf()); loginStaff("recruiter");
        assertEquals(403, post("/api/recruiter/jobs", input, null).statusCode());
        post("/api/auth/logout", Map.of(), csrf()); loginStaff("company_admin");
        assertEquals(201, post("/api/recruiter/jobs", input, csrf()).statusCode());
    }

    @Test
    void invalidJobInputCreatesNoPartialRecordsAndProtectsLifecycleFields() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment();
        var repo = context.getBean(com.lumi.recruitment.repository.JobRepository.class);
        long before = repo.count();
        var invalids = new java.util.ArrayList<Map<String, Object>>();
        for (String key : java.util.List.of("title", "description", "requirements", "location")) invalids.add(Map.of(key, "  "));
        for (Object value : java.util.List.of(0, -1, 1.5, 2147483648L)) invalids.add(Map.of("headcount", value));
        invalids.add(Map.of("departmentId", UUID.randomUUID().toString()));
        invalids.add(Map.of("experienceLevel", "EXPERT"));
        invalids.add(Map.of("salaryMin", -1));
        invalids.add(Map.of("salaryMin", 99999999999999L));
        invalids.add(Map.of("salaryMin", 50, "salaryMax", 20));
        invalids.add(Map.of("skills", java.util.List.of()));
        invalids.add(Map.of("skills", java.util.List.of(Map.of("name", "Java", "required", true), Map.of("name", "  JAVA  ", "required", false))));
        invalids.add(Map.of("criteria", java.util.List.of(Map.of("type", "OTHER", "description", "x", "required", true, "weight", 101))));
        invalids.add(Map.of("applicationDeadline", "2026-02-30"));
        for (var invalid : invalids) {
            var input = jobPayload(dept); input.putAll(invalid);
            var result = post("/api/recruiter/jobs", input, csrf());
            assertEquals(400, result.statusCode(), invalid + " => " + result.body());
        }
        var missing = jobPayload(dept); missing.remove("headcount");
        assertEquals(400, post("/api/recruiter/jobs", missing, csrf()).statusCode());
        assertEquals(before, repo.count());
        var forged = jobPayload(dept); forged.put("status", "PUBLISHED"); forged.put("createdBy", UUID.randomUUID().toString());
        var result = post("/api/recruiter/jobs", forged, csrf());
        // Unknown fields may be rejected by JSON binding; accepted input cannot set server-owned state.
        assertTrue(result.statusCode() == 400 || result.statusCode() == 201, result.body());
        if (result.statusCode() == 201) {
            var data = mapper.readTree(result.body()).path("data");
            assertEquals("DRAFT", data.path("status").asText());
            assertEquals(404, get("/api/jobs/" + data.path("id").asText()).statusCode());
        }
    }

    @Test
    void inactiveSkillRollsBackJobNewCatalogLinksCriteriaAndHistory() throws Exception {
        loginStaff("recruiter");
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        String inactive = "Inactive " + UUID.randomUUID(), fresh = "Fresh " + UUID.randomUUID();
        jdbc.update("insert into catalog.skills(name, is_active) values (?, false)", inactive);
        var counts = new java.util.LinkedHashMap<String, Long>();
        for (String table : java.util.List.of("recruitment.jobs", "catalog.skills", "recruitment.job_skills", "recruitment.job_requirements", "recruitment.job_history"))
            counts.put(table, jdbc.queryForObject("select count(*) from " + table, Long.class));
        var input = jobPayload(jobDepartment());
        input.put("skills", java.util.List.of(Map.of("name", fresh, "required", true), Map.of("name", inactive, "required", false)));
        assertEquals(400, post("/api/recruiter/jobs", input, csrf()).statusCode());
        for (var entry : counts.entrySet()) assertEquals(entry.getValue(), jdbc.queryForObject("select count(*) from " + entry.getKey(), Long.class), entry.getKey());
    }

    @Test
    void staffCanCreateFirstDepartmentButCannotUseInactiveOneOrDuplicateSkills() throws Exception {
        loginStaff("recruiter"); String name = "  Bộ phận " + UUID.randomUUID() + "  ";
        var response = post("/api/recruiter/departments", Map.of("name", name), csrf());
        assertEquals(201, response.statusCode(), response.body());
        var data = mapper.readTree(response.body()).path("data");
        assertEquals(name.trim(), data.path("name").asText());
        assertEquals(409, post("/api/recruiter/departments", Map.of("name", name.trim().toUpperCase()), csrf()).statusCode());
        assertEquals(400, post("/api/recruiter/departments", Map.of("name", "  "), csrf()).statusCode());
        UUID dept = UUID.fromString(data.path("id").asText());
        var request = jobPayload(dept);
        var first = post("/api/recruiter/jobs", request, csrf()); assertEquals(201, first.statusCode(), first.body());
        var skill = mapper.readTree(first.body()).at("/data/skills/0/id").asText();
        var second = post("/api/recruiter/jobs", request, csrf()); assertEquals(201, second.statusCode(), second.body());
        assertEquals(skill, mapper.readTree(second.body()).at("/data/skills/0/id").asText());
        var repo = context.getBean(com.lumi.recruitment.repository.DepartmentRepository.class);
        var department = repo.findById(dept).orElseThrow(); department.setActive(false); repo.saveAndFlush(department);
        assertEquals(400, post("/api/recruiter/jobs", request, csrf()).statusCode());
    }

    @Test
    void jobLifecyclePersistsContentHistoryAndPublicVisibility() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment();
        var initial = newLifecycleJob(dept); String id = initial.path("id").asText();
        var input = jobPayload(dept); input.put("title", "Updated " + UUID.randomUUID()); input.put("headcount", 7);
        input.put("applicationDeadline", java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(30).toString());
        input.put("skills", java.util.List.of(Map.of("name", "Java", "required", false), Map.of("name", "PostgreSQL", "required", true)));
        input.put("criteria", java.util.List.of(Map.of("type", "LANGUAGE", "description", "English B2", "required", false, "weight", 10)));
        var editedResponse = sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true);
        assertEquals(200, editedResponse.statusCode(), editedResponse.body());
        var edited = mapper.readTree(editedResponse.body()).path("data");
        assertEquals(1, edited.path("version").asInt()); assertEquals("DRAFT", edited.path("status").asText());
        assertEquals(initial.path("createdAt"), edited.path("createdAt")); assertEquals(7, edited.path("headcount").asInt());
        assertEquals(2, edited.path("skills").size()); assertEquals("LANGUAGE", edited.at("/criteria/0/type").asText());
        assertEquals("UPDATED", edited.at("/history/0/action").asText()); assertEquals(2, edited.path("history").size());
        assertEquals(404, get("/api/jobs/" + id).statusCode());
        var published = action(id, "publish", 1, 200);
        assertEquals("PUBLISHED", published.path("status").asText()); assertFalse(published.path("publishedAt").isNull());
        var publicResponse = get("/api/jobs/" + id); assertEquals(200, publicResponse.statusCode(), publicResponse.body());
        assertEquals(input.get("title"), mapper.readTree(publicResponse.body()).at("/data/title").asText());
        assertEquals(1, mapper.readTree(get("/api/jobs?departmentId=" + dept).body()).at("/data/totalElements").asInt());
        assertEquals(409, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 2, "content", input), true).statusCode());
        var closed = action(id, "close", 2, 200); assertEquals("CLOSED", closed.path("status").asText());
        assertEquals(404, get("/api/jobs/" + id).statusCode());
        assertEquals(0, mapper.readTree(get("/api/jobs?departmentId=" + dept).body()).at("/data/totalElements").asInt());
        var reopened = action(id, "reopen", 3, 200); assertEquals("PUBLISHED", reopened.path("status").asText());
        assertEquals(published.path("publishedAt"), reopened.path("publishedAt")); assertEquals(200, get("/api/jobs/" + id).statusCode());
        assertEquals(java.util.List.of("REOPENED", "CLOSED", "PUBLISHED", "UPDATED", "CREATED"),
                reopened.path("history").valueStream().map(h -> h.path("action").asText()).toList());
        post("/api/auth/logout", Map.of(), csrf()); newBrowserSession(); loginStaff("company_admin");
        assertEquals(reopened, mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data"));
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        String expectedAuthor = users.findByEmail("recruiter@example.test").orElseThrow().getId().toString();
        assertEquals(expectedAuthor, jdbc.queryForObject("select created_by::text from recruitment.jobs where id=?::uuid", String.class, id));
        assertEquals(1, jdbc.queryForObject("select jsonb_array_length(changes->'before'->'criteria') from recruitment.job_history where job_id=?::uuid and action='UPDATED'", Integer.class, id));
    }
    @Test
    void invalidTransitionAndStaleVersionDoNotWriteHistory() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment(); String id = newLifecycleJob(dept).path("id").asText();
        action(id, "reopen", 0, 409); action(id, "close", 0, 409); action(id, "publish", 99, 409);
        action(id, "publish", 0, 200); action(id, "publish", 1, 409); action(id, "reopen", 1, 409);
        action(id, "close", 0, 409); action(id, "close", 1, 200); action(id, "close", 2, 409);
        assertEquals(409, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", jobPayload(dept)), true).statusCode());
        var data = mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data");
        assertEquals(2, data.path("version").asInt()); assertEquals(3, data.path("history").size());
        action(UUID.randomUUID().toString(), "publish", 0, 404);
        assertEquals(400, post("/api/recruiter/jobs/" + id + "/reopen", Map.of(), csrf()).statusCode());
        assertEquals(400, post("/api/recruiter/jobs/" + id + "/reopen", Map.of("version", -1), csrf()).statusCode());
    }
    @Test
    void expiredDraftCanBeEditedButMustFixDeadlineBeforePublishAndReopen() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment(); String id = newLifecycleJob(dept).path("id").asText();
        var input = jobPayload(dept); input.put("applicationDeadline", "2000-01-01");
        assertEquals(200, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true).statusCode());
        action(id, "publish", 1, 400);
        input.put("applicationDeadline", java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toString());
        assertEquals(200, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 1, "content", input), true).statusCode());
        action(id, "publish", 2, 200); action(id, "close", 3, 200);
        input.put("applicationDeadline", "2000-01-01");
        assertEquals(400, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 4, "content", input), true).statusCode());
        // Simulate a previously published job whose deadline has now elapsed.
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update recruitment.jobs set published_at='1999-12-01T00:00:00Z' where id=?::uuid", id);
        var update = sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 4, "content", input), true);
        assertEquals(200, update.statusCode(), update.body());
        assertEquals("CLOSED", mapper.readTree(update.body()).at("/data/status").asText());
        action(id, "reopen", 5, 400);
        input.remove("applicationDeadline");
        assertEquals(200, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 5, "content", input), true).statusCode());
        action(id, "reopen", 6, 200);
    }
    @Test
    void publicationRevalidatesStoredContentDepartmentAndSkills() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment(); String id = newLifecycleJob(dept).path("id").asText();
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.departments set is_active=false where id=?", dept); action(id, "publish", 0, 400);
        jdbc.update("update recruitment.departments set is_active=true where id=?", dept);
        // Use a job-specific skill so other tests are independent.
        String skillName = "Verify " + UUID.randomUUID(); var input = jobPayload(dept); input.remove("applicationDeadline");
        input.put("skills", java.util.List.of(Map.of("name", skillName, "required", true)));
        assertEquals(200, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true).statusCode());
        jdbc.update("update catalog.skills set is_active=false where name=?", skillName); action(id, "publish", 1, 400);
        jdbc.update("update catalog.skills set is_active=true where name=?", skillName);
        jdbc.update("update recruitment.jobs set description='' where id=?::uuid", id); action(id, "publish", 1, 400);
        jdbc.update("update recruitment.jobs set description='Build API' where id=?::uuid", id);
        action(id, "publish", 1, 200); action(id, "close", 2, 200);
        jdbc.update("update catalog.skills set is_active=false where name=?", skillName); action(id, "reopen", 3, 400);
        var data = mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data");
        assertEquals(3, data.path("version").asInt()); assertEquals(4, data.path("history").size());
    }
    @Test
    void editFailureRollsBackVersionContentRelationsCatalogAndHistory() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment(); String id = newLifecycleJob(dept).path("id").asText();
        var before = mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data");
        String inactive = "Blocked edit " + UUID.randomUUID(), fresh = "Fresh edit " + UUID.randomUUID();
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("insert into catalog.skills(name,is_active) values (?,false)", inactive);
        var input = jobPayload(dept); input.put("title", "Failed change"); input.put("headcount", 8);
        input.put("skills", java.util.List.of(Map.of("name", fresh, "required", true), Map.of("name", inactive, "required", false)));
        var response = sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true);
        assertEquals(400, response.statusCode(), response.body());
        assertEquals(before, mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data"));
        assertEquals(0, jdbc.queryForObject("select count(*) from catalog.skills where name=?", Integer.class, fresh));
        input = jobPayload(dept); input.put("salaryMin", 99); input.put("salaryMax", 10);
        assertEquals(400, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true).statusCode());
        input = jobPayload(dept); input.put("headcount", 0);
        assertEquals(400, sendResume("PUT", "/api/recruiter/jobs/" + id, Map.of("version", 0, "content", input), true).statusCode());
        assertEquals(before, mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data"));
    }
    @Test
    void lifecycleWritesRequireStaffSessionCsrfAndActiveAccount() throws Exception {
        UUID dept = jobDepartment(); loginStaff("recruiter"); String id = newLifecycleJob(dept).path("id").asText();
        post("/api/auth/logout", Map.of(), csrf());
        var update = Map.of("version", 0, "content", jobPayload(dept));
        assertEquals(401, sendResume("PUT", "/api/recruiter/jobs/" + id, update, true).statusCode());
        for (String act : java.util.List.of("publish", "close", "reopen")) action(id, act, 0, 401);
        loginStaff("candidate");
        assertEquals(403, sendResume("PUT", "/api/recruiter/jobs/" + id, update, true).statusCode());
        for (String act : java.util.List.of("publish", "close", "reopen")) action(id, act, 0, 403);
        post("/api/auth/logout", Map.of(), csrf()); loginStaff("company_admin");
        assertEquals(403, sendResume("PUT", "/api/recruiter/jobs/" + id, update, false).statusCode());
        for (String act : java.util.List.of("publish", "close", "reopen"))
            assertEquals(403, post("/api/recruiter/jobs/" + id + "/" + act, Map.of("version", 0), null).statusCode());
        assertEquals(200, sendResume("PUT", "/api/recruiter/jobs/" + id, update, true).statusCode());
        action(id, "publish", 1, 200); action(id, "close", 2, 200); action(id, "reopen", 3, 200);
        var staff = users.findByEmail("company_admin@example.test").orElseThrow();
        staff.setStatus(UserStatus.INACTIVE); users.saveAndFlush(staff);
        try { action(id, "close", 4, 401); }
        finally { staff.setStatus(UserStatus.ACTIVE); users.saveAndFlush(staff); }
    }
    @Test
    void simultaneousEditsCannotOverwriteEachOtherOrAppendDuplicateHistory() throws Exception {
        loginStaff("recruiter"); UUID dept = jobDepartment(); String id = newLifecycleJob(dept).path("id").asText();
        var token = csrf(); var requests = new java.util.ArrayList<HttpRequest>();
        for (String title : java.util.List.of("Concurrent A", "Concurrent B")) {
            var input = jobPayload(dept); input.put("title", title);
            requests.add(HttpRequest.newBuilder(URI.create(baseUrl + "/api/recruiter/jobs/" + id))
                .header("Content-Type", "application/json").header(token.header(), token.value())
                .PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("version", 0, "content", input)))).build());
        }
        var first = client.sendAsync(requests.get(0), HttpResponse.BodyHandlers.ofString());
        var second = client.sendAsync(requests.get(1), HttpResponse.BodyHandlers.ofString());
        var a = first.get(); var b = second.get();
        assertEquals(java.util.Set.of(200, 409), java.util.Set.of(a.statusCode(), b.statusCode()), a.body() + b.body());
        var data = mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data");
        assertEquals(1, data.path("version").asInt()); assertEquals(2, data.path("history").size());
        assertEquals(mapper.readTree(a.statusCode() == 200 ? a.body() : b.body()).at("/data/title"), data.path("title"));
    }
    @Test
    void simultaneousPublicationOnlyAppendsOneEvent() throws Exception {
        loginStaff("recruiter"); String id = newLifecycleJob(jobDepartment()).path("id").asText(); var token = csrf();
        var request = HttpRequest.newBuilder(URI.create(baseUrl + "/api/recruiter/jobs/" + id + "/publish"))
            .header("Content-Type", "application/json").header(token.header(), token.value())
            .POST(HttpRequest.BodyPublishers.ofString("{\"version\":0}")).build();
        var first = client.sendAsync(request, HttpResponse.BodyHandlers.ofString()); var second = client.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        var a = first.get(); var b = second.get();
        assertEquals(java.util.Set.of(200, 409), java.util.Set.of(a.statusCode(), b.statusCode()), a.body() + b.body());
        var data = mapper.readTree(get("/api/recruiter/jobs/" + id).body()).path("data");
        assertEquals(1, data.path("version").asInt()); assertEquals(2, data.path("history").size());
    }
    @Test
    void reopeningLegacyClosedJobWithoutPublicationDateAssignsFirstPublication() throws Exception {
        loginStaff("recruiter"); String id = newLifecycleJob(jobDepartment()).path("id").asText();
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update recruitment.jobs set status='CLOSED' where id=?::uuid", id);
        var reopened = action(id, "reopen", 0, 200);
        assertFalse(reopened.path("publishedAt").isNull());
        assertEquals("REOPENED", reopened.at("/history/0/action").asText());
        assertEquals(200, get("/api/jobs/" + id).statusCode());
    }
    private String submittedApplication() throws Exception {
        String job=applicationJob(); var cv=applicationResume("READY");
        var response=post("/api/candidate/applications",applicationInput(job,cv),csrf());
        assertEquals(201,response.statusCode(),response.body());
        return mapper.readTree(response.body()).at("/data/id").asText();
    }
    private JsonNode review(String id) throws Exception {
        var response=get("/api/recruiter/applications/"+id+"/review");
        assertEquals(200,response.statusCode(),response.body());
        return mapper.readTree(response.body()).path("data");
    }
    private HttpResponse<String> changeStage(String id,String status,long version,String reason) throws Exception {
        return post("/api/recruiter/applications/"+id+"/status",Map.of("status",status,"version",version,"reason",reason),csrf());
    }
    @Test void hrReviewPersistsNotesForwardStagesAndPrivateAuditWithoutChangingEvidence() throws Exception {
        String id=submittedApplication(); var candidateClient=client;
        var original=mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data");
        newBrowserSession();loginStaff("recruiter");
        assertEquals("REVIEWING",review(id).at("/allowedTransitions/0").asText());
        UUID requestId=UUID.randomUUID(); var note=Map.of("body","  Internal review only\nJava API discussion  ","requestId",requestId);
        var added=post("/api/recruiter/applications/"+id+"/notes",note,csrf());
        assertEquals(201,added.statusCode(),added.body());
        assertEquals(201,post("/api/recruiter/applications/"+id+"/notes",note,csrf()).statusCode());
        assertEquals(409,post("/api/recruiter/applications/"+id+"/notes",Map.of("body","Different","requestId",requestId),csrf()).statusCode());
        assertEquals(1,review(id).path("notes").size());
        assertEquals("Internal review only\nJava API discussion",review(id).at("/notes/0/body").asText());
        assertEquals("Người dùng RECRUITER",review(id).at("/notes/0/authorName").asText());
        String[] stages={"REVIEWING","INTERVIEW","OFFER","HIRED"};
        for(int i=0;i<stages.length;i++) {
            var response=changeStage(id,stages[i],i,"Internal decision "+i);
            assertEquals(200,response.statusCode(),response.body());
            assertEquals(i+1,mapper.readTree(response.body()).at("/data/application/version").asLong());
        }
        var finalReview=review(id);assertEquals(5,finalReview.path("history").size());
        assertEquals("Người dùng RECRUITER",finalReview.at("/history/4/actorName").asText());
        assertEquals("Internal decision 3",finalReview.at("/history/4/reason").asText());
        assertEquals(0,finalReview.path("allowedTransitions").size());
        assertEquals(409,changeStage(id,"REVIEWING",4,"Reopen").statusCode());
        assertEquals(original.path("resumeSnapshot"),finalReview.at("/application/resumeSnapshot"));
        assertEquals(original.path("jobSnapshot"),finalReview.at("/application/jobSnapshot"));
        String job=original.path("jobId").asText();
        assertEquals(1,mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).at("/data/stages/HIRED").asInt());
        assertEquals(0,mapper.readTree(get("/api/recruiter/applications?jobId="+job+"&stage=SUBMITTED").body()).at("/data/totalElements").asInt());
        var candidate= candidateClient.send(HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications/"+id)).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,candidate.statusCode());
        var publicData=mapper.readTree(candidate.body()).path("data");
        assertEquals("HIRED",publicData.path("status").asText());assertEquals(5,publicData.path("history").size());
        for(String privateValue:java.util.List.of("Internal", "actorName", "authorName", "actorId", "reason", "notes", "changedBy"))
            assertFalse(candidate.body().contains(privateValue),privateValue);
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update recruitment.application_notes set body='Changed' where application_id=?::uuid",id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("delete from recruitment.application_notes where application_id=?::uuid",id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update recruitment.application_status_history set reason='Changed' where application_id=?::uuid",id));
    }
    @Test void hrReviewRejectsSkippedBackwardStaleAndTerminalTransitions() throws Exception {
        String id=submittedApplication();newBrowserSession();loginStaff("recruiter");
        assertEquals(409,changeStage(id,"INTERVIEW",0,"").statusCode());
        assertEquals(400,changeStage(id,"REJECTED",0," \n ").statusCode());
        assertEquals(200,changeStage(id,"REVIEWING",0,"").statusCode());
        assertEquals(409,changeStage(id,"INTERVIEW",0,"").statusCode());
        assertEquals(409,changeStage(id,"REVIEWING",1,"").statusCode());
        assertEquals(400,changeStage(id,"WITHDRAWN",1,"").statusCode());
        assertEquals(200,changeStage(id,"REJECTED",1,"Thiếu kinh nghiệm REST API cần thiết").statusCode());
        assertEquals(409,changeStage(id,"INTERVIEW",2,"Reopen").statusCode());
        assertEquals(3,review(id).path("history").size());
        assertEquals(201,post("/api/recruiter/applications/"+id+"/notes",Map.of("body","Ghi chú sau khi kết thúc","requestId",UUID.randomUUID()),csrf()).statusCode());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.applications set status='WITHDRAWN' where id=?::uuid",id);
        assertEquals(0,review(id).path("allowedTransitions").size());
        assertEquals(409,changeStage(id,"REVIEWING",2,"").statusCode());
    }
    @Test void hrReviewEnforcesRoleSessionCsrfValidationAndActiveAccount() throws Exception {
        String id=submittedApplication();String base="/api/recruiter/applications/"+id;
        var note=Map.of("body","Private note","requestId",UUID.randomUUID());
        assertEquals(403,get(base+"/review").statusCode());assertEquals(403,post(base+"/notes",note,csrf()).statusCode());
        assertEquals(403,post(base+"/status",Map.of("status","REVIEWING","version",0),csrf()).statusCode());
        newBrowserSession();assertEquals(401,get(base+"/review").statusCode());
        loginStaff("recruiter");assertEquals(403,post(base+"/notes",note,null).statusCode());
        assertEquals(403,post(base+"/status",Map.of("status","REVIEWING","version",0),null).statusCode());
        for(var invalid:java.util.List.<Map<String,?>>of(Map.of("body",""),Map.of("body","x".repeat(4001),"requestId",UUID.randomUUID()),Map.of("body"," \n ","requestId",UUID.randomUUID())))
            assertEquals(400,post(base+"/notes",invalid,csrf()).statusCode());
        for(var invalid:java.util.List.<Map<String,?>>of(Map.of("status","REVIEWING"),Map.of("status","REVIEWING","version",-1),Map.of("status","REVIEWING","version",0,"reason","x".repeat(2001)),Map.of("status","BAD","version",0)))
            assertEquals(400,post(base+"/status",invalid,csrf()).statusCode());
        assertEquals(404,post("/api/recruiter/applications/"+UUID.randomUUID()+"/notes",note,csrf()).statusCode());
        assertEquals(404,changeStage(UUID.randomUUID().toString(),"REVIEWING",0,"").statusCode());
        User u=users.findByEmail("recruiter@example.test").orElseThrow();u.setStatus(UserStatus.INACTIVE);users.saveAndFlush(u);
        try { assertEquals(401,get(base+"/review").statusCode());assertEquals(401,post(base+"/notes",note,csrf()).statusCode()); }
        finally {u.setStatus(UserStatus.ACTIVE);users.saveAndFlush(u);}
        newBrowserSession();loginStaff("company_admin");assertEquals(200,changeStage(id,"REVIEWING",0,"Admin review").statusCode());
        assertEquals(201,post(base+"/notes",note,csrf()).statusCode());
    }
    @Test void hrReviewSerializesConcurrentChangesAndDeduplicatesNoteRetries() throws Exception {
        String id=submittedApplication();newBrowserSession();loginStaff("recruiter");var token=csrf();
        var statusRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/applications/"+id+"/status"))
            .header("Content-Type","application/json").header(token.header(),token.value())
            .POST(HttpRequest.BodyPublishers.ofString("{\"status\":\"REVIEWING\",\"version\":0}")).build();
        var a=client.sendAsync(statusRequest,HttpResponse.BodyHandlers.ofString());var b=client.sendAsync(statusRequest,HttpResponse.BodyHandlers.ofString());
        var statuses=java.util.stream.Stream.of(a.join().statusCode(),b.join().statusCode()).sorted().toList();
        assertEquals(java.util.List.of(200,409),statuses);assertEquals(2,review(id).path("history").size());
        var noteRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/applications/"+id+"/notes"))
            .header("Content-Type","application/json").header(token.header(),token.value())
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("body","Concurrent note","requestId",UUID.randomUUID())))).build();
        var x=client.sendAsync(noteRequest,HttpResponse.BodyHandlers.ofString());var y=client.sendAsync(noteRequest,HttpResponse.BodyHandlers.ofString());
        assertEquals(201,x.join().statusCode());assertEquals(201,y.join().statusCode());assertEquals(1,review(id).path("notes").size());
        assertEquals(1,review(id).at("/application/version").asInt());
    }
    @Test void hrReviewRollsBackStatusWhenAuditInsertFails() throws Exception {
        String id=submittedApplication();newBrowserSession();loginStaff("recruiter");
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.execute("CREATE FUNCTION recruitment.test_review_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced audit failure'; END $$");
        jdbc.execute("CREATE TRIGGER test_review_failure BEFORE INSERT ON recruitment.application_status_history FOR EACH ROW EXECUTE FUNCTION recruitment.test_review_failure()");
        try {assertEquals(500,changeStage(id,"REVIEWING",0,"Attempt").statusCode());}
        finally {jdbc.execute("DROP TRIGGER test_review_failure ON recruitment.application_status_history");jdbc.execute("DROP FUNCTION recruitment.test_review_failure()");}
        assertEquals("SUBMITTED",review(id).at("/application/status").asText());assertEquals(0,review(id).at("/application/version").asLong());
        assertEquals(1,review(id).path("history").size());assertEquals(200,changeStage(id,"REVIEWING",0,"Retry").statusCode());
    }

    private Map<String,Object> aiStubResult(JsonNode input,String mode) {
        var entries=new java.util.ArrayList<Map<String,Object>>();
        var job=input.path("job");
        java.math.BigDecimal weightTotal=java.math.BigDecimal.ZERO, sum=java.math.BigDecimal.ZERO;
        for(String group:java.util.List.of("skills","criteria")) for(var t:job.path(group)) {
            var weight=group.equals("skills")?java.math.BigDecimal.valueOf(t.path("required").asBoolean()?2:1):new java.math.BigDecimal(t.path("weight").asText());
            boolean absent=mode.equals("missing-docker") && group.equals("skills") && t.path("name").asText().equals("Docker");
            int points=absent?0:80;
            entries.add(Map.of("criterion_key",(group.equals("skills")?"skill:":"criterion:")+t.path("id").asText(),
                "skill",t.path(group.equals("skills")?"name":"description").asText(),"match_level",absent?"NO_EVIDENCE":"PARTIAL",
                "evidence",absent?"":mode.equals("match-bad-evidence")?"Invented quote":"Java","reason","Cần trao đổi thêm", "points",mode.equals("bad")?999:points,"weight",weight));
            weightTotal=weightTotal.add(weight);sum=sum.add(weight.multiply(java.math.BigDecimal.valueOf(points)));
        }
        int score=weightTotal.signum()==0?0:sum.divide(weightTotal,0,java.math.RoundingMode.HALF_UP).intValue();
        return Map.of("application_id",input.path("application_id").asText(),"model_name","test-model",
            "prompt_version","v3","score",score,"summary","Kết quả kiểm thử Java REST API",
            "matched_skills",java.util.List.of("Java"),"missing_skills",java.util.List.of("Docker"),"criteria",entries,
            "gaps",java.util.List.of(Map.of("skill","Docker","current_level","Chưa đủ bằng chứng","target_level","Theo JD","roadmap","Thực hành container")),
            "interview_questions",java.util.List.of(Map.of("question","Bạn xử lý transaction thế nào?","reason","Làm rõ kinh nghiệm","target_skill","Java")));
    }
    @Test void aiAssessmentPersistsFullContractAndRefreshesListsSummaryWithoutChangingEvidence() throws Exception {
        String id=submittedApplication();var candidateClient=client;newBrowserSession();loginStaff("recruiter");aiMode="ok";aiCalls.set(0);
        var before=review(id).path("application");String path="/api/recruiter/applications/"+id+"/assessment";
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        var first=post(path,Map.of(),csrf());assertEquals(201,first.statusCode(),first.body());
        var result=mapper.readTree(first.body()).path("data");assertEquals(80,result.path("score").asInt());
        assertEquals(3,result.path("criteria").size());
        assertTrue(result.path("criteria").valueStream().anyMatch(c->c.path("weight").asDouble()==25.5));
        assertEquals("Theo JD",result.at("/gaps/0/targetLevel").asText());
        assertEquals("Java",result.at("/interviewQuestions/0/targetSkill").asText());
        assertTrue(lastAiRequest.at("/job/employmentType").isString());
        assertTrue(lastAiRequest.at("/resume/fullName").isMissingNode());
        assertEquals(before,review(id).path("application"));
        assertEquals(201,post(path,Map.of(),csrf()).statusCode());assertEquals(1,aiCalls.get());
        assertEquals(201,post(path,Map.of("force",true),csrf()).statusCode());assertEquals(2,aiCalls.get());
        String job=before.path("jobId").asText();
        var list=mapper.readTree(get("/api/recruiter/applications?jobId="+job).body()).at("/data/content/0");assertEquals(80,list.path("aiScore").asInt());assertFalse(list.path("assessedAt").isNull());
        var summary=mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).path("data");assertEquals(1,summary.path("assessed").asInt());assertEquals(id,summary.at("/priority/0/id").asText());
        var other=mapper.readTree(get("/api/recruiter/applications/summary?jobId="+UUID.randomUUID()).body()).path("data");assertEquals(0,other.path("assessed").asInt());assertTrue(other.path("priority").isEmpty());
        assertEquals(200,changeStage(id,"REJECTED",0,"Not selected").statusCode());
        var ended=mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).path("data");assertEquals(1,ended.path("assessed").asInt());assertTrue(ended.path("priority").isEmpty());
        newBrowserSession();loginStaff("company_admin");assertEquals(80,mapper.readTree(get(path).body()).at("/data/score").asInt());
        var candidate=candidateClient.send(HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications?jobId="+job)).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,candidate.statusCode());assertTrue(mapper.readTree(candidate.body()).at("/data/content/0/aiScore").isNull());assertFalse(candidate.body().contains("Kết quả kiểm thử"));
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(2,jdbc.queryForObject("select count(*) from recruitment.ai_assessments where application_id=?::uuid",Integer.class,id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update recruitment.ai_assessments set score=0 where application_id=?::uuid",id));
    }
    @Test void aiAssessmentRejectsInvalidResultsAndRollsBackWithoutLosingPreviousAssessment() throws Exception {
        String id=submittedApplication();newBrowserSession();loginStaff("recruiter");String path="/api/recruiter/applications/"+id+"/assessment";
        try {
            aiMode="bad";assertEquals(503,post(path,Map.of(),csrf()).statusCode());assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
            aiMode="ok";assertEquals(201,post(path,Map.of(),csrf()).statusCode());var saved=mapper.readTree(get(path).body()).path("data");
            aiMode="unavailable";assertEquals(503,post(path,Map.of("force",true),csrf()).statusCode());assertEquals(saved,mapper.readTree(get(path).body()).path("data"));
            aiMode="slow";long start=System.nanoTime();assertEquals(503,post(path,Map.of("force",true),csrf()).statusCode());assertTrue(java.time.Duration.ofNanos(System.nanoTime()-start).toMillis()<3000);
            aiMode="ok";var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
            jdbc.execute("CREATE FUNCTION recruitment.test_ai_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test'; END $$");
            jdbc.execute("CREATE TRIGGER test_ai_failure BEFORE INSERT ON recruitment.ai_assessment_criteria FOR EACH ROW EXECUTE FUNCTION recruitment.test_ai_failure()");
            try {assertEquals(500,post(path,Map.of("force",true),csrf()).statusCode());}
            finally {jdbc.execute("DROP TRIGGER test_ai_failure ON recruitment.ai_assessment_criteria");jdbc.execute("DROP FUNCTION recruitment.test_ai_failure()");}
            assertEquals(1,jdbc.queryForObject("select count(*) from recruitment.ai_assessments where application_id=?::uuid",Integer.class,id));
        } finally {aiMode="ok";}
    }
    @Test void aiAssessmentEnforcesPermissionsCsrfActiveStaffAndNotFound() throws Exception {
        String id=submittedApplication();String path="/api/recruiter/applications/"+id+"/assessment";
        assertEquals(403,get(path).statusCode());assertEquals(403,post(path,Map.of(),csrf()).statusCode());
        newBrowserSession();assertEquals(401,get(path).statusCode());loginStaff("recruiter");assertEquals(403,post(path,Map.of(),null).statusCode());
        assertEquals(404,get("/api/recruiter/applications/"+UUID.randomUUID()+"/assessment").statusCode());
        assertEquals(404,post("/api/recruiter/applications/"+UUID.randomUUID()+"/assessment",Map.of(),csrf()).statusCode());
        var user=users.findByEmail("recruiter@example.test").orElseThrow();user.setStatus(UserStatus.INACTIVE);users.saveAndFlush(user);
        try {assertEquals(401,get(path).statusCode());assertEquals(401,post(path,Map.of(),csrf()).statusCode());}
        finally {user.setStatus(UserStatus.ACTIVE);users.saveAndFlush(user);}
    }
    @Test void aiAssessmentDeduplicatesConcurrentRequests() throws Exception {
        String id=submittedApplication();newBrowserSession();loginStaff("recruiter");var token=csrf();aiCalls.set(0);aiMode="concurrent";
        try {
            var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/applications/"+id+"/assessment")).header("Content-Type","application/json").header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
            var a=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());var b=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            assertEquals(java.util.List.of(201,409),java.util.stream.Stream.of(a.join().statusCode(),b.join().statusCode()).sorted().toList());assertEquals(1,aiCalls.get());
        } finally {aiMode="ok";}
    }

    @Test void publicJobApplicationCountTracksSubmissionsPerJobWithoutExposingApplicants() throws Exception {
        String job=applicationJob();String otherJob=applicationJob();var cv=applicationResume("READY");
        assertEquals(0,mapper.readTree(get("/api/jobs/"+job).body()).at("/data/applicationCount").asLong());
        var first=post("/api/candidate/applications",applicationInput(job,cv),csrf());assertEquals(201,first.statusCode(),first.body());
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        assertEquals(1,mapper.readTree(get("/api/jobs/"+job).body()).at("/data/applicationCount").asLong());
        newBrowserSession();registerResumeOwner();var secondCv=applicationResume("READY");
        assertEquals(201,post("/api/candidate/applications",applicationInput(job,secondCv),csrf()).statusCode());
        // Counts report past submissions, not just candidates still in active stages.
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update recruitment.applications set status='WITHDRAWN' where id=?::uuid",mapper.readTree(first.body()).at("/data/id").asText());
        newBrowserSession(); // The aggregate is public; individual CVs and identities remain private.
        var publicDetail=get("/api/jobs/"+job);assertEquals(200,publicDetail.statusCode());
        var data=mapper.readTree(publicDetail.body()).path("data");assertEquals(2,data.path("applicationCount").asLong());
        assertFalse(publicDetail.body().contains("cv@example.test"));assertFalse(publicDetail.body().contains("candidateId"));assertFalse(publicDetail.body().contains("Tên trên CV"));
        assertEquals(0,mapper.readTree(get("/api/jobs/"+otherJob).body()).at("/data/applicationCount").asLong());
        var list=mapper.readTree(get("/api/jobs?size=100&ids="+job+","+otherJob).body()).at("/data/content");
        assertEquals(2,list.size());
        for(var item:list) assertEquals(item.path("id").asText().equals(job)?2:0,item.path("applicationCount").asLong());
    }

    private String applicationJob() throws Exception {
        loginStaff("recruiter"); String id=newLifecycleJob(jobDepartment()).path("id").asText();
        action(id,"publish",0,200); newBrowserSession(); registerResumeOwner(); return id;
    }
    private JsonNode applicationResume(String status) throws Exception {
        var response=post("/api/candidate/resumes",resumePayload("Submitted CV",status),csrf());
        assertEquals(201,response.statusCode(),response.body());return mapper.readTree(response.body()).path("data");
    }
    private Map<String,Object> applicationInput(String job,JsonNode cv) {
        return Map.of("jobId",job,"resumeId",cv.path("id").asText(),"resumeVersion",cv.path("version").asLong(),"coverLetter","Tôi quan tâm vị trí này");
    }
    @Test void applicationsPersistFullSnapshotsAcrossCvAndJobEditsAndProtectUsedCv() throws Exception {
        String job=applicationJob(); var cv=applicationResume("READY"); var input=applicationInput(job,cv);
        var response=post("/api/candidate/applications",input,csrf());assertEquals(201,response.statusCode(),response.body());
        var app=mapper.readTree(response.body()).path("data");String id=app.path("id").asText();
        assertEquals(mapper.readTree(get("/api/candidate/resumes/"+cv.path("id").asText()).body()).path("data"),app.path("resumeSnapshot"));assertEquals(1,app.path("history").size());
        assertEquals("SUBMITTED",app.path("status").asText());assertEquals(2,app.at("/jobSnapshot/skills").size());
        var changed=resumePayload("Edited CV","READY");changed.put("version",cv.path("version").asLong());changed.put("fullName","New name");
        assertEquals(200,sendResume("PUT","/api/candidate/resumes/"+cv.path("id").asText(),changed,true).statusCode());
        var deletion=client.send(HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/resumes/"+cv.path("id").asText()+"?version=1")).header(csrf().header(),csrf().value()).DELETE().build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(409,deletion.statusCode(),deletion.body());assertTrue(deletion.body().contains("CV đã dùng"));
        assertEquals(409,post("/api/candidate/applications",input,csrf()).statusCode());
        assertEquals(1,mapper.readTree(get("/api/candidate/applications?jobId="+job).body()).at("/data/totalElements").asInt());
        newBrowserSession();loginStaff("recruiter");action(job,"close",1,200);
        var old=mapper.readTree(get("/api/recruiter/jobs/"+job).body()).path("data");
        var jd=jobPayload(UUID.fromString(old.path("departmentId").asText()));jd.put("title","Changed JD");jd.remove("applicationDeadline");
        assertEquals(200,sendResume("PUT","/api/recruiter/jobs/"+job,Map.of("version",2,"content",jd),true).statusCode());
        var hr=mapper.readTree(get("/api/recruiter/applications/"+id).body()).path("data");
        assertEquals(app,hr);assertEquals("Java Developer",hr.at("/jobSnapshot/title").asText());
        assertFalse(hr.toString().contains("changedBy"));assertEquals(200,get("/api/recruiter/applications?jobId="+job).statusCode());
        assertEquals(1,mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).at("/data/stages/SUBMITTED").asInt());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update recruitment.application_resume_snapshots set schema_version=2 where application_id=?::uuid",id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("update recruitment.applications set job_snapshot='{}'::jsonb where id=?::uuid",id));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update("delete from recruitment.application_status_history where application_id=?::uuid",id));
    }
    @Test void applicationsRejectDraftStaleForeignCvAndUnavailableJobs() throws Exception {
        String job=applicationJob();var cv=applicationResume("DRAFT");
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        cv=applicationResume("READY");var stale=new java.util.HashMap<>(applicationInput(job,cv));stale.put("resumeVersion",99);
        assertEquals(409,post("/api/candidate/applications",stale,csrf()).statusCode());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.jobs set published_at=now()+interval '1 day' where id=?::uuid",job);
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        jdbc.update("update recruitment.jobs set published_at=now()-interval '2 days', application_deadline=now()-interval '1 day' where id=?::uuid",job);
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        jdbc.update("update recruitment.jobs set application_deadline=null,status='CLOSED' where id=?::uuid",job);
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        jdbc.update("update recruitment.jobs set status='PUBLISHED' where id=?::uuid",job);
        jdbc.update("update recruitment.departments set is_active=false where id=(select department_id from recruitment.jobs where id=?::uuid)",job);
        assertEquals(409,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        jdbc.update("update recruitment.departments set is_active=true where id=(select department_id from recruitment.jobs where id=?::uuid)",job);
        newBrowserSession();registerResumeOwner();
        assertEquals(404,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.applications where job_id=?::uuid",Integer.class,job));
    }
    @Test void applicationsEnforceSessionRoleCsrfOwnershipAndActiveAccount() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var input=applicationInput(job,cv);
        assertEquals(403,post("/api/candidate/applications",input,null).statusCode());
        assertEquals(403,get("/api/recruiter/applications").statusCode());
        var response=post("/api/candidate/applications",input,csrf());assertEquals(201,response.statusCode(),response.body());
        String id=mapper.readTree(response.body()).at("/data/id").asText();
        newBrowserSession();assertEquals(401,get("/api/candidate/applications/"+id).statusCode());
        registerResumeOwner();assertEquals(404,get("/api/candidate/applications/"+id).statusCode());
        var self=mapper.readTree(get("/api/auth/me").body()).path("data");
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update auth.users set status='INACTIVE' where id=?::uuid",self.path("id").asText());
        assertEquals(401,get("/api/candidate/applications").statusCode());
        newBrowserSession();loginStaff("recruiter");assertEquals(403,post("/api/candidate/applications",input,csrf()).statusCode());
        assertEquals(200,get("/api/recruiter/applications/"+id).statusCode());
        newBrowserSession();loginStaff("company_admin");assertEquals(200,get("/api/recruiter/applications/"+id).statusCode());
        assertEquals(400,get("/api/recruiter/applications?stage=BAD").statusCode());
        assertEquals(400,get("/api/recruiter/applications?size=101").statusCode());
    }
    @Test void applicationsSerializeConcurrentSubmissionAndCommitOnlyOneCompleteRecord() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var token=csrf();
        var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications")).header("Content-Type","application/json").header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(applicationInput(job,cv)))).build();
        var first=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());var second=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
        assertEquals(java.util.Set.of(201,409),java.util.Set.of(first.get().statusCode(),second.get().statusCode()));
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(1,jdbc.queryForObject("select count(*) from recruitment.applications a join recruitment.application_resume_snapshots s on s.application_id=a.id join recruitment.application_status_history h on h.application_id=a.id where a.job_id=?::uuid",Integer.class,job));
    }
    @Test void applicationSummaryCountsAllPagesAndFiltersUseLiteralSearch() throws Exception {
        String job=applicationJob();
        for(int i=0;i<12;i++) {
            if(i>0){newBrowserSession();registerResumeOwner();}
            var cv=applicationResume("READY");assertEquals(201,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
        }
        newBrowserSession();loginStaff("recruiter");
        var page=mapper.readTree(get("/api/recruiter/applications?jobId="+job+"&size=5&page=2").body()).path("data");
        assertEquals(2,page.path("content").size());assertEquals(12,page.path("totalElements").asInt());assertEquals(3,page.path("totalPages").asInt());
        assertEquals(12,mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).at("/data/total").asInt());
        assertEquals(0,mapper.readTree(get("/api/recruiter/applications?jobId="+job+"&search=%25").body()).at("/data/totalElements").asInt());
        assertEquals(0,mapper.readTree(get("/api/recruiter/applications?jobId="+job+"&stage=HIRED").body()).at("/data/totalElements").asInt());
    }
    @Test void failedSnapshotInsertRollsBackApplicationAndInitialHistory() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.execute("CREATE FUNCTION recruitment.test_snapshot_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$");
        jdbc.execute("CREATE TRIGGER test_snapshot_failure BEFORE INSERT ON recruitment.application_resume_snapshots FOR EACH ROW EXECUTE FUNCTION recruitment.test_snapshot_failure()");
        try {
            assertEquals(500,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
            assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.applications where job_id=?::uuid",Integer.class,job));
        } finally {jdbc.execute("DROP TRIGGER test_snapshot_failure ON recruitment.application_resume_snapshots");jdbc.execute("DROP FUNCTION recruitment.test_snapshot_failure()");}
        assertEquals(201,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
    }
    @Test void applicationSubmissionRacesCvEditWithoutMixingVersions() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var token=csrf();
        var edit=resumePayload("Changed concurrently","READY");edit.put("version",0);edit.put("fullName","Concurrent new name");
        var applyRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications")).header("Content-Type","application/json").header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(applicationInput(job,cv)))).build();
        var editRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/resumes/"+cv.path("id").asText())).header("Content-Type","application/json").header(token.header(),token.value()).PUT(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(edit))).build();
        var submitted=client.sendAsync(applyRequest,HttpResponse.BodyHandlers.ofString());var edited=client.sendAsync(editRequest,HttpResponse.BodyHandlers.ofString());
        assertEquals(200,edited.get().statusCode());var response=submitted.get();assertTrue(response.statusCode()==201 || response.statusCode()==409,response.body());
        if(response.statusCode()==201){var app=mapper.readTree(response.body()).path("data");assertEquals(0,app.at("/resumeSnapshot/version").asInt());assertEquals("Tên trên CV",app.at("/resumeSnapshot/fullName").asText());}
    }
    @Test void applicationSubmissionRacesJobCloseWithConsistentOutcome() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var token=csrf();var candidateClient=client;
        var applyRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications")).header("Content-Type","application/json").header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(applicationInput(job,cv)))).build();
        newBrowserSession();loginStaff("recruiter");var staffToken=csrf();
        var closeRequest=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/jobs/"+job+"/close")).header("Content-Type","application/json").header(staffToken.header(),staffToken.value()).POST(HttpRequest.BodyPublishers.ofString("{\"version\":1}")).build();
        var submitted=candidateClient.sendAsync(applyRequest,HttpResponse.BodyHandlers.ofString());var closed=client.sendAsync(closeRequest,HttpResponse.BodyHandlers.ofString());
        assertEquals(200,closed.get().statusCode());var response=submitted.get();assertTrue(response.statusCode()==201 || response.statusCode()==409,response.body());
        if(response.statusCode()==201) assertEquals("PUBLISHED",mapper.readTree(response.body()).at("/data/jobSnapshot/status").asText());
        assertEquals(response.statusCode()==201?1:0,mapper.readTree(get("/api/recruiter/applications/summary?jobId="+job).body()).at("/data/total").asInt());
    }
    private JsonNode newLifecycleJob(UUID dept) throws Exception {
        var input = jobPayload(dept); input.remove("applicationDeadline");
        var response = post("/api/recruiter/jobs", input, csrf()); assertEquals(201, response.statusCode(), response.body());
        return mapper.readTree(response.body()).path("data");
    }
    private JsonNode action(String id, String action, long version, int expected) throws Exception {
        var response = post("/api/recruiter/jobs/" + id + "/" + action, Map.of("version", version), csrf());
        assertEquals(expected, response.statusCode(), response.body()); return mapper.readTree(response.body()).path("data");
    }

    private User profileActor(UserRole role) throws Exception {
        var actor=users.saveAndFlush(User.builder().email("profile-"+UUID.randomUUID()+"@example.test")
            .fullName("HR Profile Test").role(role).passwordHash(users.findByEmail("recruiter@example.test").orElseThrow().getPasswordHash()).build());
        newBrowserSession();
        assertEquals(200,post("/api/auth/login",Map.of("email",actor.getEmail(),"password","LoginTest123!"),csrf()).statusCode());
        return actor;
    }
    private JsonNode hrProfile() throws Exception {
        var response=get("/api/recruiter/profile");assertEquals(200,response.statusCode(),response.body());
        return mapper.readTree(response.body()).path("data");
    }
    @Test void recruiterProfilePersistsOwnFieldsAndIgnoresAccountIdentity() throws Exception {
        var actor=profileActor(UserRole.RECRUITER);var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        var original=hrProfile();assertEquals(0,original.path("version").asLong());assertTrue(original.path("jobTitle").isNull());
        assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.recruiter_profiles where user_id=?",Integer.class,actor.getId()));
        UUID dept=jobDepartment();var input=new java.util.HashMap<String,Object>();
        input.put("version",0);input.put("phone"," +84 900 123 456 ");input.put("jobTitle"," Chuyên viên tuyển dụng ");
        input.put("employeeCode"," HR-"+UUID.randomUUID()+" ");input.put("departmentId",dept.toString());input.put("avatarUrl"," https://example.test/avatar.png ");
        var admin=users.findByEmail("company_admin@example.test").orElseThrow();
        input.put("userId",admin.getId().toString());input.put("email","changed@example.test");input.put("role","COMPANY_ADMIN");input.put("fullName","Changed");
        var response=sendResume("PUT","/api/recruiter/profile",input,true);assertEquals(200,response.statusCode(),response.body());
        var result=mapper.readTree(response.body()).path("data");assertEquals(result,hrProfile());
        assertEquals(actor.getId().toString(),result.path("userId").asText());assertEquals(actor.getEmail(),result.path("email").asText());
        assertEquals(actor.getFullName(),result.path("fullName").asText());assertEquals("RECRUITER",result.path("role").asText());
        assertEquals("+84 900 123 456",result.path("phone").asText());assertEquals("Chuyên viên tuyển dụng",result.path("jobTitle").asText());
        assertEquals("https://example.test/avatar.png",result.path("avatarUrl").asText());assertEquals(dept.toString(),result.path("departmentId").asText());
        assertEquals(1,result.path("version").asLong());assertFalse(result.path("updatedAt").isNull());assertFalse(response.body().contains("password"));
        assertEquals(admin.getFullName(),users.findById(admin.getId()).orElseThrow().getFullName());
        var other=profileActor(UserRole.COMPANY_ADMIN);assertEquals(other.getId().toString(),hrProfile().path("userId").asText());assertTrue(hrProfile().path("phone").isNull());
        newBrowserSession();assertEquals(200,post("/api/auth/login",Map.of("email",actor.getEmail(),"password","LoginTest123!"),csrf()).statusCode());
        var clear=sendResume("PUT","/api/recruiter/profile",Map.of("version",1,"jobTitle","   ","employeeCode"," ","phone"," ","avatarUrl"," "),true);
        assertEquals(200,clear.statusCode(),clear.body());assertTrue(hrProfile().path("departmentId").isNull());assertTrue(hrProfile().path("phone").isNull());
        assertTrue(hrProfile().path("employeeCode").isNull());assertTrue(hrProfile().path("jobTitle").isNull());assertEquals(2,hrProfile().path("version").asLong());
    }
    @Test void recruiterProfileRejectsInvalidFieldsWithoutWriting() throws Exception {
        var actor=profileActor(UserRole.RECRUITER);var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        java.util.List<Map<String,?>> cases=java.util.List.of(Map.of(),Map.of("version",-1),Map.of("version",0,"phone","abc1234567"),
            Map.of("version",0,"phone","123"),Map.of("version",0,"phone","1234567890123456"),Map.of("version",0,"avatarUrl","javascript:alert(1)"),
            Map.of("version",0,"avatarUrl","https://user:pass@example.test/a"),Map.of("version",0,"avatarUrl","ftp://example.test/a"),
            Map.of("version",0,"jobTitle","x".repeat(256)),Map.of("version",0,"employeeCode","x".repeat(51)),
            Map.of("version",0,"departmentId",UUID.randomUUID().toString()),Map.of("version",0,"departmentId","bad-id"));
        for(var input:cases) {var response=sendResume("PUT","/api/recruiter/profile",input,true);assertEquals(400,response.statusCode(),response.body());}
        assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.recruiter_profiles where user_id=?",Integer.class,actor.getId()));
    }
    @Test void recruiterProfileEnforcesSessionRoleCsrfAndActiveAccount() throws Exception {
        assertEquals(401,get("/api/recruiter/profile").statusCode());
        assertEquals(401,sendResume("PUT","/api/recruiter/profile",Map.of("version",0),true).statusCode());
        loginStaff("candidate");assertEquals(403,get("/api/recruiter/profile").statusCode());
        assertEquals(403,sendResume("PUT","/api/recruiter/profile",Map.of("version",0),true).statusCode());
        var actor=profileActor(UserRole.COMPANY_ADMIN);assertEquals("COMPANY_ADMIN",hrProfile().path("role").asText());
        assertEquals(403,sendResume("PUT","/api/recruiter/profile",Map.of("version",0),false).statusCode());
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"jobTitle","Admin"),true).statusCode());
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update auth.users set status='INACTIVE' where id=?",actor.getId());
        assertEquals(401,get("/api/recruiter/profile").statusCode());
    }
    @Test void recruiterProfilePreservesInactiveDepartmentButRejectsNewAssignments() throws Exception {
        profileActor(UserRole.RECRUITER);var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);UUID dept=jobDepartment();
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"departmentId",dept.toString()),true).statusCode());
        jdbc.update("update recruitment.departments set is_active=false where id=?",dept);
        assertFalse(hrProfile().path("departmentActive").asBoolean());
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",1,"departmentId",dept.toString(),"jobTitle","HR"),true).statusCode());
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",2),true).statusCode());
        assertEquals(400,sendResume("PUT","/api/recruiter/profile",Map.of("version",3,"departmentId",dept.toString()),true).statusCode());
        assertEquals(3,hrProfile().path("version").asLong());assertTrue(hrProfile().path("departmentId").isNull());
    }
    @Test void recruiterProfileRejectsDuplicateEmployeeCodeAndStaleFormsAtomically() throws Exception {
        profileActor(UserRole.RECRUITER);String code="HR-"+UUID.randomUUID();
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"employeeCode",code),true).statusCode());
        var actor=profileActor(UserRole.RECRUITER);
        var duplicate=sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"employeeCode",code.toLowerCase(),"jobTitle","Must roll back"),true);
        assertEquals(409,duplicate.statusCode(),duplicate.body());assertTrue(duplicate.body().contains("Mã nhân viên"));
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.recruiter_profiles where user_id=?",Integer.class,actor.getId()));
        assertEquals(200,sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"jobTitle","Saved"),true).statusCode());
        assertEquals(409,sendResume("PUT","/api/recruiter/profile",Map.of("version",0,"jobTitle","Stale"),true).statusCode());
        assertEquals("Saved",hrProfile().path("jobTitle").asText());assertEquals(1,hrProfile().path("version").asLong());
    }
    @Test void recruiterProfileSerializesConcurrentFirstSaves() throws Exception {
        var actor=profileActor(UserRole.RECRUITER);var token=csrf();
        var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/profile")).header("Content-Type","application/json")
            .header(token.header(),token.value()).PUT(HttpRequest.BodyPublishers.ofString("{\"version\":0,\"jobTitle\":\"Saved once\"}")).build();
        var first=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());var second=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
        assertEquals(java.util.List.of(200,409),java.util.stream.Stream.of(first.join().statusCode(),second.join().statusCode()).sorted().toList());
        assertEquals(1,hrProfile().path("version").asLong());
        assertEquals(1,context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).queryForObject("select count(*) from recruitment.recruiter_profiles where user_id=?",Integer.class,actor.getId()));
    }

    @Test
    void positionsAreScopedAndRequiredAndCannotUseInactiveOrCrossDepartmentEntries() throws Exception {
        UUID dept = jobDepartment(), other = jobDepartment();
        var input = jobPayload(dept);
        var foreign = jobPayload(other);
        assertEquals(401, get("/api/recruiter/positions?departmentId=" + dept).statusCode());
        loginStaff("candidate");
        assertEquals(403, get("/api/recruiter/positions?departmentId=" + dept).statusCode());
        post("/api/auth/logout", Map.of(), csrf()); loginStaff("recruiter");
        var listed = get("/api/recruiter/positions?departmentId=" + dept);
        assertEquals(200, listed.statusCode(), listed.body());
        assertEquals(input.get("positionId"), mapper.readTree(listed.body()).at("/data/0/id").asText());
        assertEquals(dept.toString(), mapper.readTree(listed.body()).at("/data/0/departmentId").asText());
        var missing = new java.util.HashMap<>(input); missing.remove("positionId");
        assertEquals(400, post("/api/recruiter/jobs", missing, csrf()).statusCode());
        var wrong = new java.util.HashMap<>(input); wrong.put("positionId", foreign.get("positionId"));
        assertEquals(400, post("/api/recruiter/jobs", wrong, csrf()).statusCode());
        var created = post("/api/recruiter/jobs", input, csrf());
        assertEquals(201, created.statusCode(), created.body());
        var job = mapper.readTree(created.body()).path("data");
        assertEquals(input.get("positionId"), job.path("positionId").asText());
        assertEquals("Backend Developer", job.path("positionName").asText());
        assertEquals("Java Developer", job.path("title").asText());
        assertEquals(400, sendResume("PUT", "/api/recruiter/jobs/" + job.path("id").asText(), Map.of("version", 0, "content", wrong), true).statusCode());
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update recruitment.job_positions set is_active=false where id=?::uuid", input.get("positionId"));
        assertEquals(0, mapper.readTree(get("/api/recruiter/positions?departmentId=" + dept).body()).path("data").size());
        assertEquals(400, post("/api/recruiter/jobs", input, csrf()).statusCode());
        action(job.path("id").asText(), "publish", 0, 400);
    }

    @Test
    void publicJobSummaryUsesServerSourcesCsrfAndSharedPersistentCache() throws Exception {
        String id = summaryJob(); String path = "/api/jobs/" + id + "/ai-summary";
        summaryCalls.set(0); summaryMode = "ok";
        newBrowserSession();
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(0, summaryCalls.get());
        assertEquals(403, post(path, Map.of(), null).statusCode());
        var response = post(path, Map.of("sources", "forged job text"), csrf());
        assertEquals(200, response.statusCode(), response.body());
        var result = mapper.readTree(response.body()).path("data");
        assertEquals("Build API", result.path("items").get(0).path("quote").asText());
        assertEquals(id, result.path("jobId").asText());
        assertTrue(result.path("sourceHash").asText().matches("[a-f0-9]{64}"));
        assertTrue(lastSummaryRequest.toString().contains("Ưu tiên: Docker"));
        assertTrue(lastSummaryRequest.toString().contains("Bắt buộc: Java"));
        assertFalse(lastSummaryRequest.toString().contains("forged"));
        assertFalse(lastSummaryRequest.toString().contains("resume"));
        newBrowserSession();
        assertEquals(result, mapper.readTree(get(path).body()).path("data"));
        assertEquals(result, mapper.readTree(post(path, Map.of(), csrf()).body()).path("data"));
        assertEquals(1, summaryCalls.get());
        assertEquals("no-store", get(path).headers().firstValue("cache-control").orElseThrow());
    }

    @Test
    void jobSummaryInvalidatesOnJdChildAndCatalogChangesAndRejectsHiddenJobs() throws Exception {
        String id = summaryJob(); String path = "/api/jobs/" + id + "/ai-summary";
        summaryMode = "ok"; summaryCalls.set(0);
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        var first = mapper.readTree(get(path).body()).at("/data/sourceHash").asText();
        jdbc.update("update recruitment.jobs set requirements='New Java requirement' where id=?::uuid", id);
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        assertNotEquals(first, mapper.readTree(get(path).body()).at("/data/sourceHash").asText());
        jdbc.update("update recruitment.job_skills set is_required=not is_required where job_id=?::uuid", id);
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        jdbc.update("update recruitment.job_requirements set description='Two years' where job_id=?::uuid", id);
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        // A catalog rename also changes the canonical input, even without a job version bump.
        jdbc.update("update recruitment.departments set name=name||' renamed' where id=(select department_id from recruitment.jobs where id=?::uuid)", id);
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        assertEquals(5, summaryCalls.get());
        jdbc.update("update recruitment.jobs set status='CLOSED' where id=?::uuid", id);
        assertEquals(404, get(path).statusCode()); assertEquals(404, post(path, Map.of(), csrf()).statusCode());
        jdbc.update("update recruitment.jobs set status='PUBLISHED',published_at=now()+interval '1 day' where id=?::uuid", id);
        assertEquals(404, get(path).statusCode());
        jdbc.update("update recruitment.jobs set published_at=now()-interval '2 days',application_deadline=now()-interval '1 day' where id=?::uuid", id);
        assertEquals(404, post(path, Map.of(), csrf()).statusCode());
        assertEquals(5, summaryCalls.get());
    }

    @Test
    void jobSummaryRejectsInvalidEvidenceAndProviderFailuresWithoutCaching() throws Exception {
        String id = summaryJob(); String path = "/api/jobs/" + id + "/ai-summary";
        try {
            for (String mode : java.util.List.of("bad-quote", "bad-category", "bad-hash", "empty", "unavailable", "slow")) {
                summaryMode = mode;
                var response = post(path, Map.of(), csrf());
                assertEquals(503, response.statusCode(), mode + ": " + response.body());
                assertFalse(response.body().contains("Invented salary"));
                assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
            }
            summaryMode = "ok";
            assertEquals(200, post(path, Map.of(), csrf()).statusCode());
        } finally { summaryMode = "ok"; }
    }

    @Test
    void concurrentJobSummaryCallsOnlyInvokeProviderOnce() throws Exception {
        String id = summaryJob(); String path = "/api/jobs/" + id + "/ai-summary";
        summaryEntered = new java.util.concurrent.CountDownLatch(1);
        summaryRelease = new java.util.concurrent.CountDownLatch(1);
        summaryMode = "hold"; summaryCalls.set(0);
        var token = csrf();
        try {
            var first = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try { return post(path, Map.of(), token); } catch (Exception e) { throw new RuntimeException(e); }
            });
            assertTrue(summaryEntered.await(3, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(409, post(path, Map.of(), token).statusCode());
            summaryRelease.countDown();
            var response = first.get(3, java.util.concurrent.TimeUnit.SECONDS);
            assertEquals(200, response.statusCode(), response.body());
            assertEquals(1, summaryCalls.get());
        } finally { summaryRelease.countDown(); summaryMode = "ok"; }
    }

    @Test
    void jobEditedDuringSummaryGenerationCannotStoreOrReturnOldSummary() throws Exception {
        String id = summaryJob(); String path = "/api/jobs/" + id + "/ai-summary";
        summaryEntered = new java.util.concurrent.CountDownLatch(1);
        summaryRelease = new java.util.concurrent.CountDownLatch(1);
        summaryMode = "hold"; var token = csrf();
        try {
            var first = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try { return post(path, Map.of(), token); } catch (Exception e) { throw new RuntimeException(e); }
            });
            assertTrue(summaryEntered.await(3, java.util.concurrent.TimeUnit.SECONDS));
            context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                .update("update recruitment.jobs set description='Updated while generating' where id=?::uuid", id);
            summaryRelease.countDown();
            assertEquals(409, first.get(3, java.util.concurrent.TimeUnit.SECONDS).statusCode());
            assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
            assertEquals(0, context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                .queryForObject("select count(*) from recruitment.job_ai_summaries where job_id=?::uuid", Integer.class, id));
        } finally { summaryRelease.countDown(); summaryMode = "ok"; }
    }

    @Test void candidateMatchPersistsCacheWithoutApplyingAndOmitsContactData() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");String path="/api/candidate/jobs/"+job+"/match";
        cv=mapper.readTree(get("/api/candidate/resumes/"+cv.path("id").asText()).body()).path("data");
        aiMode="match-ok";aiCalls.set(0);
        assertTrue(mapper.readTree(get(path+"?resumeId="+cv.path("id").asText()).body()).path("data").isNull());
        var response=post(path,Map.of("resumeId",cv.path("id").asText()),csrf());assertEquals(200,response.statusCode(),response.body());
        var match=mapper.readTree(response.body()).path("data");assertEquals(80,match.path("score").asInt());
        assertEquals(3,match.path("criteria").size());assertEquals("candidate-match-v4",match.path("promptVersion").asText());
        assertEquals("test-model",match.path("modelName").asText());assertFalse(match.at("/criteria/0/jobEvidence").asText().isBlank());
        assertEquals("CV · Kỹ năng tự khai",match.at("/criteria/0/source").asText());
        for(String field:java.util.List.of("email","phone","fullName","linkedinUrl")) assertTrue(lastAiRequest.path("resume").path(field).isMissingNode());
        assertEquals(200,post(path,Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());assertEquals(1,aiCalls.get());
        assertEquals(429,post(path,Map.of("resumeId",cv.path("id").asText(),"force",true),csrf()).statusCode());
        var cached=get(path+"?resumeId="+cv.path("id").asText());assertEquals("no-store",cached.headers().firstValue("Cache-Control").orElse(""));
        assertEquals(80,mapper.readTree(cached.body()).at("/data/score").asInt());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(0,jdbc.queryForObject("select count(*) from recruitment.applications where job_id=?::uuid",Integer.class,job));
        assertEquals(cv,mapper.readTree(get("/api/candidate/resumes/"+cv.path("id").asText()).body()).path("data"));
    }
    @Test void candidateMatchInvalidatesForCvAndJdChildrenAndCatalogChanges() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");String resume=cv.path("id").asText();String path="/api/candidate/jobs/"+job+"/match";
        aiMode="match-ok";aiCalls.set(0);assertEquals(200,post(path,Map.of("resumeId",resume),csrf()).statusCode());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.job_requirements set weight=weight+1 where job_id=?::uuid",job);
        assertTrue(mapper.readTree(get(path+"?resumeId="+resume).body()).path("data").isNull());
        assertEquals(200,post(path,Map.of("resumeId",resume),csrf()).statusCode());assertEquals(2,aiCalls.get());
        String skill=jdbc.queryForObject("select skill_id::text from recruitment.job_skills where job_id=?::uuid order by skill_id limit 1",String.class,job);
        String original=jdbc.queryForObject("select name from catalog.skills where id=?::uuid",String.class,skill);
        try {
            jdbc.update("update catalog.skills set name=? where id=?::uuid",original+" revised",skill);
            assertTrue(mapper.readTree(get(path+"?resumeId="+resume).body()).path("data").isNull());
        } finally {jdbc.update("update catalog.skills set name=? where id=?::uuid",original,skill);}
        var edit=resumePayload("CV updated","READY");edit.put("version",cv.path("version").asLong());edit.put("summary","Built Java API");
        assertEquals(200,sendResume("PUT","/api/candidate/resumes/"+resume,edit,true).statusCode());
        assertTrue(mapper.readTree(get(path+"?resumeId="+resume).body()).path("data").isNull());
        var fresh=post(path,Map.of("resumeId",resume),csrf());assertEquals(200,fresh.statusCode(),fresh.body());
        assertEquals(1,mapper.readTree(fresh.body()).at("/data/resumeVersion").asLong());
    }
    @Test void candidateMatchRequiresOwnReadyCvOpenJobAndCsrf() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var draft=applicationResume("DRAFT");String path="/api/candidate/jobs/"+job+"/match";
        assertEquals(403,post(path,Map.of("resumeId",cv.path("id").asText()),null).statusCode());
        assertEquals(400,post(path,Map.of(),csrf()).statusCode());
        assertEquals(400,post(path,Map.of("resumeId",draft.path("id").asText()),csrf()).statusCode());
        var original=client;newBrowserSession();registerResumeOwner();
        assertEquals(404,post(path,Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
        newBrowserSession();assertEquals(401,get(path+"?resumeId="+cv.path("id").asText()).statusCode());
        client=original;var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.jobs set status='CLOSED' where id=?::uuid",job);
        assertEquals(404,post(path,Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
        newBrowserSession();loginStaff("recruiter");assertEquals(403,get(path+"?resumeId="+cv.path("id").asText()).statusCode());
    }
    @Test void candidateMatchRejectsInvalidEvidenceAndUnavailableProviderWithoutCache() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");String path="/api/candidate/jobs/"+job+"/match";
        try {for(String mode:java.util.List.of("match-bad-evidence","bad","unavailable","slow")) {
            aiMode=mode;var response=post(path,Map.of("resumeId",cv.path("id").asText()),csrf());assertEquals(503,response.statusCode(),response.body());
            assertTrue(mapper.readTree(get(path+"?resumeId="+cv.path("id").asText()).body()).path("data").isNull());
        }} finally {aiMode="ok";}
    }
    @Test void candidateMatchCannotStoreResultIfCvChangesDuringAiRequest() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");String path="/api/candidate/jobs/"+job+"/match";
        aiMode="match-hold";matchEntered=new java.util.concurrent.CountDownLatch(1);matchRelease=new java.util.concurrent.CountDownLatch(1);
        var token=csrf();var request=HttpRequest.newBuilder(URI.create(baseUrl+path)).header("Content-Type","application/json").header(token.header(),token.value())
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("resumeId",cv.path("id").asText())))).build();
        var pending=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
        try {
            assertTrue(matchEntered.await(2,java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(409,post(path,Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
            var edit=resumePayload("Changed during AI","READY");edit.put("version",cv.path("version").asLong());
            assertEquals(200,sendResume("PUT","/api/candidate/resumes/"+cv.path("id").asText(),edit,true).statusCode());
            matchRelease.countDown();var response=pending.get(3,java.util.concurrent.TimeUnit.SECONDS);assertEquals(409,response.statusCode(),response.body());
            assertTrue(mapper.readTree(get(path+"?resumeId="+cv.path("id").asText()).body()).path("data").isNull());
        } finally {matchRelease.countDown();aiMode="ok";}
    }

    private com.lumi.recruitment.service.AiAnalysisTaskService.Task claimOnly(String application) {
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.ai_analysis_tasks set next_attempt_at='infinity' where status='PENDING' and application_id<>?::uuid",application);
        jdbc.update("update recruitment.ai_analysis_tasks set next_attempt_at=now() where status='PENDING' and application_id=?::uuid",application);
        var task=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).claim();
        assertNotNull(task);assertEquals(application,task.applicationId().toString());return task;
    }
    private JsonNode ownAiStatus(String application) throws Exception {
        var response=get("/api/candidate/applications/"+application+"/ai-status");assertEquals(200,response.statusCode(),response.body());
        assertEquals("no-store",response.headers().firstValue("Cache-Control").orElse(""));return mapper.readTree(response.body()).path("data");
    }
    private String submitTo(String job) throws Exception {
        var cv=applicationResume("READY");var response=post("/api/candidate/applications",applicationInput(job,cv),csrf());
        assertEquals(201,response.statusCode(),response.body());return mapper.readTree(response.body()).at("/data/id").asText();
    }
    @Test void automaticAiQueuesAtomicallyAndReusesMatchingWithoutAnotherProviderCall() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");aiMode="match-ok";aiCalls.set(0);
        var matched=post("/api/candidate/jobs/"+job+"/match",Map.of("resumeId",cv.path("id").asText()),csrf());assertEquals(200,matched.statusCode(),matched.body());
        var applied=post("/api/candidate/applications",applicationInput(job,cv),csrf());assertEquals(201,applied.statusCode(),applied.body());
        String id=mapper.readTree(applied.body()).at("/data/id").asText();var before=mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data");
        assertEquals("PENDING",ownAiStatus(id).path("state").asText());
        var tasks=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class);var task=claimOnly(id);tasks.process(task);
        var status=ownAiStatus(id);assertEquals("COMPLETED",status.path("state").asText());assertEquals(80,status.path("score").asInt());assertEquals(1,aiCalls.get());
        assertEquals(before,mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data"));
        tasks.process(task);tasks.enqueue(UUID.fromString(id));assertEquals(1,aiCalls.get());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertEquals(1,jdbc.queryForObject("select count(*) from recruitment.ai_assessments where application_id=?::uuid",Integer.class,id));
        newBrowserSession();registerResumeOwner();assertEquals(404,get("/api/candidate/applications/"+id+"/ai-status").statusCode());
        newBrowserSession();assertEquals(401,get("/api/candidate/applications/"+id+"/ai-status").statusCode());
    }
    @Test void automaticAiRetriesAreBoundedAndProviderErrorsNeverBlockSavedApplications() throws Exception {
        String id=submittedApplication();aiMode="unavailable";aiCalls.set(0);
        var tasks=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class);
        try {for(int attempt=1;attempt<=3;attempt++) {
            tasks.process(claimOnly(id));var state=ownAiStatus(id);assertEquals(attempt,state.path("attempts").asInt());
            assertEquals(attempt<3?"PENDING":"FAILED",state.path("state").asText());assertTrue(state.path("score").isNull());
            assertEquals("SUBMITTED",mapper.readTree(get("/api/candidate/applications/"+id).body()).at("/data/status").asText());
        } assertEquals(3,aiCalls.get());tasks.enqueue(UUID.fromString(id));assertNull(tasks.claim());}
        finally {aiMode="ok";}
    }
    @Test void automaticAiRecoversLeasesAndIgnoresStaleWorkers() throws Exception {
        String id=submittedApplication();aiMode="ok";aiCalls.set(0);
        var tasks=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class);var first=claimOnly(id);
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.ai_analysis_tasks set lease_until=now()-interval '1 second' where id=?",first.id());
        var second=tasks.claim();assertNotNull(second);assertNotEquals(first.leaseToken(),second.leaseToken());
        tasks.fail(first,new IllegalStateException("PRIVATE_PROVIDER_BODY"));tasks.process(first);assertEquals(0,aiCalls.get());
        assertEquals("PROCESSING",ownAiStatus(id).path("state").asText());tasks.process(second);
        assertEquals("COMPLETED",ownAiStatus(id).path("state").asText());assertEquals(1,aiCalls.get());
        assertFalse(ownAiStatus(id).toString().contains("PRIVATE_PROVIDER_BODY"));
    }
    @Test void automaticAiSkipsWithdrawnApplicationsWithoutSendingCv() throws Exception {
        String id=submittedApplication();aiCalls.set(0);
        context.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("update recruitment.applications set status='WITHDRAWN' where id=?::uuid",id);
        context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));
        assertEquals("SKIPPED",ownAiStatus(id).path("state").asText());assertEquals(0,aiCalls.get());
    }
    @Test void automaticAiWorkerDispatchesAndPreservesApplicationStage() throws Exception {
        String id=submittedApplication();aiMode="concurrent";aiCalls.set(0);
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.ai_analysis_tasks set next_attempt_at='infinity' where status='PENDING' and application_id<>?::uuid",id);
        var worker=new com.lumi.recruitment.service.AiAnalysisWorker(context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class));
        try {
            worker.dispatch();worker.dispatch();
            for(int i=0;i<150 && !"COMPLETED".equals(ownAiStatus(id).path("state").asText());i++) Thread.sleep(20);
            assertEquals("COMPLETED",ownAiStatus(id).path("state").asText());assertEquals(1,aiCalls.get());
            assertEquals("SUBMITTED",mapper.readTree(get("/api/candidate/applications/"+id).body()).at("/data/status").asText());
        } finally {worker.shutdown();aiMode="ok";}
    }
    @Test void candidateBenchmarkSuppressesSmallCohortsHandlesTiesAndExposesOnlyAggregates() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");var ownerClient=client;aiMode="match-ok";
        String path="/api/candidate/jobs/"+job+"/benchmark?resumeId="+cv.path("id").asText();
        assertEquals("NEEDS_MATCH",mapper.readTree(get(path).body()).at("/data/status").asText());
        assertEquals(200,post("/api/candidate/jobs/"+job+"/match",Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
        assertEquals("INSUFFICIENT_DATA",mapper.readTree(get(path).body()).at("/data/status").asText());
        var tasks=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class);String lastApplication="";var peerApplications=new java.util.ArrayList<String>();
        for(int i=0;i<10;i++) {
            newBrowserSession();registerResumeOwner();lastApplication=submitTo(job);peerApplications.add(lastApplication);tasks.process(claimOnly(lastApplication));
            assertEquals("COMPLETED",ownAiStatus(lastApplication).path("state").asText());
            if(i==8) {
                var peerClient=client;client=ownerClient;var partial=mapper.readTree(get(path).body()).path("data");
                assertEquals("INSUFFICIENT_DATA",partial.path("status").asText());assertEquals(9,partial.path("analyzedPeers").asInt());assertTrue(partial.path("criteria").isEmpty());assertTrue(partial.path("percentile").isNull());client=peerClient;
            }
        }
        client=ownerClient;aiCalls.set(0);var response=get(path);assertEquals(200,response.statusCode(),response.body());
        var result=mapper.readTree(response.body()).path("data");assertEquals("READY",result.path("status").asText());assertEquals(10,result.path("analyzedPeers").asInt());
        assertEquals(50,result.path("percentile").asDouble());assertEquals(100,result.path("equalPercent").asDouble());assertEquals(80,result.path("medianScore").asDouble());assertEquals(0,aiCalls.get());
        for(String secret:java.util.List.of("candidateId","applicationId","resumeId","cv@example.test","Tên trên CV","Java REST API")) assertFalse(response.body().contains(secret),secret);
        var evaluator=context.getBean(com.lumi.recruitment.service.ApplicationAiEvaluator.class);
        aiMode="missing-docker";
        for(String peer:peerApplications.subList(0,6)) evaluator.evaluate(UUID.fromString(peer),true);
        var sparse=mapper.readTree(get(path).body()).path("data");assertEquals("READY",sparse.path("status").asText());
        var docker=sparse.path("criteria").valueStream().filter(c->c.path("name").asText().equals("Docker")).findFirst().orElseThrow();
        assertEquals(4,docker.path("peerEvidenceCount").asInt());assertTrue(docker.path("peerMedian").isNull());
        assertEquals(80,sparse.path("percentile").asDouble());aiMode="match-ok";
        // A newer result replaces the prior one; it must not count as another candidate.
        evaluator.evaluate(UUID.fromString(lastApplication),true);
        assertEquals(10,mapper.readTree(get(path).body()).at("/data/analyzedPeers").asInt());
        // A different model is not silently mixed into the comparison.
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("insert into recruitment.ai_assessments(application_id,model_name,prompt_version,score,summary,job_context_hash,input_hash,evaluation_version) select application_id,'other-model',prompt_version,score,summary,job_context_hash,input_hash,evaluation_version from recruitment.ai_assessments where application_id=?::uuid order by created_at desc limit 1",lastApplication);
        assertEquals("INSUFFICIENT_DATA",mapper.readTree(get(path).body()).at("/data/status").asText());
        jdbc.update("update recruitment.jobs set description='New JD content',version=version+1 where id=?::uuid",job);
        assertEquals("NEEDS_MATCH",mapper.readTree(get(path).body()).at("/data/status").asText());
        assertEquals(200,post("/api/candidate/jobs/"+job+"/match",Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
        assertEquals(0,mapper.readTree(get(path).body()).at("/data/totalPeers").asInt());
        newBrowserSession();registerResumeOwner();assertEquals(404,get(path).statusCode());newBrowserSession();assertEquals(401,get(path).statusCode());
    }

    private String summaryJob() throws Exception {
        loginStaff("recruiter");
        var input = jobPayload(jobDepartment()); input.remove("applicationDeadline");
        var response = post("/api/recruiter/jobs", input, csrf());
        assertEquals(201, response.statusCode(), response.body());
        String id = mapper.readTree(response.body()).at("/data/id").asText();
        action(id, "publish", 0, 200);
        return id;
    }

    private void loginStaff(String role) throws Exception {
        assertEquals(200, post("/api/auth/login", Map.of("email", role + "@example.test", "password", "LoginTest123!"), csrf()).statusCode());
    }
    private UUID jobDepartment() {
        var d = new com.lumi.recruitment.entity.recruitment.Department(); d.setName("Dept " + UUID.randomUUID());
        return context.getBean(com.lumi.recruitment.repository.DepartmentRepository.class).saveAndFlush(d).getId();
    }
    private java.util.HashMap<String, Object> jobPayload(UUID department) {
        var input = new java.util.HashMap<String, Object>();
        var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("insert into recruitment.job_positions(department_id,name) values (?,'Backend Developer') on conflict do nothing", department);
        input.put("positionId", jdbc.queryForObject("select id::text from recruitment.job_positions where department_id=? and name='Backend Developer'", String.class, department));
        input.put("departmentId", department.toString()); input.put("title", "Java Developer"); input.put("headcount", 3);
        input.put("description", "Build API"); input.put("requirements", "Understand Java"); input.put("benefits", "");
        input.put("location", "Đà Nẵng"); input.put("employmentType", "FULL_TIME"); input.put("workMode", "HYBRID"); input.put("experienceLevel", "JUNIOR");
        input.put("salaryMin", 15000000); input.put("salaryMax", 25000000); input.put("applicationDeadline", "2026-10-29");
        input.put("skills", java.util.List.of(Map.of("name", "Java", "required", true), Map.of("name", "Docker", "required", false)));
        input.put("criteria", java.util.List.of(Map.of("type", "EXPERIENCE", "description", "One year", "required", true, "weight", 25.5)));
        return input;
    }

    private void registerResumeOwner() throws Exception {
        assertEquals(201, post("/api/auth/register", Map.of("email", "resume-" + UUID.randomUUID() + "@example.test", "password", "LoginTest123!", "fullName", "CV Owner"), csrf()).statusCode());
    }
    private java.util.HashMap<String, Object> resumePayload(String title, String status) {
        var body = new java.util.HashMap<String, Object>();
        body.put("title", title); body.put("status", status); body.put("template", "modern");
        body.put("fullName", "Tên trên CV"); body.put("email", "cv@example.test"); body.put("desiredPosition", "Java Developer");
        body.put("githubUrl", "https://github.com/test"); body.put("skills", java.util.List.of("Java", "SQL", "Java"));
        body.put("experiences", java.util.List.of(Map.of("company", "Lumi", "position", "Developer", "startDate", "2024-01", "endDate", "", "current", true, "description", "Build API")));
        body.put("educations", java.util.List.of(Map.of("school", "Đại học", "degree", "Cử nhân", "field", "CNTT", "startDate", "2020-09", "endDate", "2024-06", "description", "")));
        body.put("projects", java.util.List.of(Map.of("name", "Hiring", "role", "Backend", "url", "https://example.test", "description", "Recruitment app")));
        body.put("certifications", java.util.List.of(Map.of("name", "Java", "issuer", "Test", "issuedDate", "2024-01", "credentialUrl", "https://example.test/cert")));
        body.put("languages", java.util.List.of(Map.of("name", "Tiếng Anh", "proficiency", "B2", "certification", "IELTS 6.5")));
        body.put("awards", java.util.List.of(Map.of("title", "Hackathon", "issuer", "University", "awardedDate", "2025-09", "description", "First prize")));
        body.put("activities", java.util.List.of(Map.of("name", "Coding club", "organization", "University", "role", "Mentor", "startDate", "2024-01", "endDate", "", "current", true, "description", "Mentored students\nOrganized workshops")));
        return body;
    }
    private HttpResponse<String> sendResume(String method, String path, Map<String, ?> body, boolean withCsrf) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(baseUrl + path)).header("Content-Type", "application/json");
        if (withCsrf) { var token = csrf(); request.header(token.header(), token.value()); }
        return client.send(request.method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(baseUrl + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> post(String path, Map<String, ?> body, Token token) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(baseUrl + path)).header("Content-Type", "application/json");
        if (token != null) request.header(token.header(), token.value());
        return client.send(request.POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    private Token csrf() throws Exception {
        var response = get("/api/auth/csrf");
        assertEquals(200, response.statusCode(), response.body());
        var data = mapper.readTree(response.body()).path("data");
        return new Token(data.path("headerName").asText(), data.path("token").asText());
    }

    private String sessionId() {
        return cookies.getCookieStore().getCookies().stream().filter(cookie -> cookie.getName().equals("JSESSIONID"))
                .findFirst().orElseThrow().getValue();
    }

    private record Token(String header, String value) { }

    @RestController
    static class AccessProbe {
        @GetMapping({"/api/recruiter/test-access", "/api/candidate/test-access"})
        public Map<String, Boolean> access() {
            return Map.of("allowed", true);
        }
    }
}
