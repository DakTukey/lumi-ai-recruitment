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
    private final java.util.concurrent.atomic.AtomicInteger parseCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile boolean parseFails;
    private volatile int parseResponseStatus=200;
    private volatile boolean parseBareLinks;
    private final java.util.concurrent.atomic.AtomicInteger clarificationCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String clarificationMode = "ok";
    private volatile JsonNode lastClarificationRequest;
    private volatile java.util.concurrent.CountDownLatch clarificationEntered;
    private volatile java.util.concurrent.CountDownLatch clarificationRelease;
    private final java.util.concurrent.atomic.AtomicInteger scorecardCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String scorecardMode="ok";
    private volatile JsonNode lastScorecardRequest;
    private volatile java.util.concurrent.CountDownLatch scorecardEntered;
    private volatile java.util.concurrent.CountDownLatch scorecardRelease;
    private final java.util.concurrent.atomic.AtomicInteger githubCalls = new java.util.concurrent.atomic.AtomicInteger();
    private volatile JsonNode lastGithubRequest;
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
        aiStub.createContext("/api/cv-parser", exchange -> {
            parseCalls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
            var result = resumePayload("Original PDF", "DRAFT");
            if(parseBareLinks) result.put("portfolioUrl","portfolio.example.test/work");
            result.put("summary", "Original PDF evidence");
            result.put("sources",java.util.List.of(Map.of("path","summary","quote","Original PDF evidence","page",1,"verified",true)));
            result.put("extraSections", java.util.List.of(Map.of("title", "Research", "content", "Paper in 2023")));
            result.put("warnings", java.util.List.of("Check source")); result.put("pageCount", 1); result.put("extractedText", "Page 1: Original PDF evidence");
            byte[] output = mapper.writeValueAsString(result).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            if(parseResponseStatus==429) exchange.getResponseHeaders().set("Retry-After","45");
            exchange.sendResponseHeaders(parseFails ? 503 : parseResponseStatus, output.length);
            exchange.getResponseBody().write(output); exchange.close();
        });
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
        aiStub.createContext("/api/jobs/parse-jd", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = mapper.writeValueAsString(Map.of("title", "Imported Java JD", "level", "", "mode", "",
                "location", "", "headcount", "", "suggestedDepartment", "Unknown Department Fixture",
                "skills", java.util.List.of(Map.of("name", "Java", "required", true)),
                "criteria", java.util.List.of(Map.of("id", "crit-1", "type", "EXPERIENCE", "description", "Java", "required", true, "weight", 0))))
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes); exchange.close();
        });
        aiStub.createContext("/api/application-clarifications", exchange -> {
            clarificationCalls.incrementAndGet();
            var input=mapper.readTree(new String(exchange.getRequestBody().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
            lastClarificationRequest=input;
            if(clarificationMode.equals("hold")) {
                clarificationEntered.countDown();
                try {clarificationRelease.await(3,java.util.concurrent.TimeUnit.SECONDS);} catch(InterruptedException e) {Thread.currentThread().interrupt();}
            }
            var questions=new java.util.ArrayList<Map<String,String>>();
            for(var target:input.path("targets")) questions.add(Map.of("criterion_key",clarificationMode.equals("invalid")?"invented":target.path("criterion_key").asText(),
                "question","Bạn có thể chia sẻ vai trò và kết quả một dự án liên quan đến "+target.path("requirement").asText()+" không?"));
            byte[] bytes=mapper.writeValueAsBytes(Map.of("questions",questions,"model_name","test-model","prompt_version","clarifications-v1"));
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(clarificationMode.equals("unavailable")?503:200,bytes.length);
            exchange.getResponseBody().write(bytes);exchange.close();
        });
        aiStub.createContext("/api/interview-scorecard/generate",exchange->{
            scorecardCalls.incrementAndGet();lastScorecardRequest=mapper.readTree(exchange.getRequestBody().readAllBytes());
            if("hold".equals(scorecardMode)) {
                scorecardEntered.countDown();try {scorecardRelease.await(3,java.util.concurrent.TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}
            }
            var sections=new java.util.ArrayList<Map<String,Object>>();
            for(int i=0;i<2;i++) {
                var questions=new java.util.ArrayList<Map<String,Object>>();
                for(int j=0;j<3;j++)questions.add(Map.of("id","invalid".equals(scorecardMode)?"duplicate":"q"+i+j,"question","Hãy chia sẻ ví dụ Java?","target_skill","Java","context","Cần làm rõ dữ liệu ứng viên tự cung cấp","rubric_good","Có ví dụ cụ thể","rubric_poor","Chưa mô tả rõ"));
                sections.add(Map.of("title","Nhóm "+i,"questions",questions));
            }
            byte[] bytes=mapper.writeValueAsBytes(Map.of("sections",sections,"model_name","test-model"));
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders("unavailable".equals(scorecardMode)?503:200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });
        aiStub.createContext("/api/github-verify",exchange->{
            githubCalls.incrementAndGet();lastGithubRequest=mapper.readTree(exchange.getRequestBody().readAllBytes());
            var result=new java.util.HashMap<String,Object>();result.put("github_username","test");
            result.put("verified_skills",java.util.List.of(Map.of("skill","Java","evidence","Dữ liệu công khai thử nghiệm")));result.put("unverified_skills",java.util.List.of(Map.of("skill","Docker","note","Chưa có bằng chứng công khai")));
            result.put("matched_projects",java.util.List.of());result.put("code_quality_score",7);result.put("technical_summary","Kết quả thử nghiệm GitHub.");result.put("interview_suggestions",java.util.List.of("Hãy mô tả cách dùng Docker?"));result.put("vibe_coding_flags",java.util.List.of());
            result.put("has_tests",true);result.put("has_docker",false);result.put("has_ci",false);result.put("top_languages",Map.of("Java",100));result.put("model_name","test-model");
            byte[] bytes=mapper.writeValueAsBytes(result);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });
        aiStub.start();
        context = new SpringApplicationBuilder(RecruitmentBackendApplication.class, AccessProbe.class)
                .run("--server.port=0", "--app.cv-builder.enabled=true", "--app.ai-analysis.worker-enabled=false", "--app.ai-service.url=http://127.0.0.1:"+aiStub.getAddress().getPort(),
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
                "skill",t.path(group.equals("skills")?"name":"description").asText(),"match_level",absent?"NO_EVIDENCE":mode.equals("all-matched")?"MATCHED":"PARTIAL",
                "evidence",absent?"":mode.equals("match-bad-evidence")?"Invented quote":"Java","reason","Cần trao đổi thêm", "points",mode.equals("bad")?999:points,"weight",weight));
            weightTotal=weightTotal.add(weight);sum=sum.add(weight.multiply(java.math.BigDecimal.valueOf(points)));
        }
        int score=weightTotal.signum()==0?0:sum.divide(weightTotal,0,java.math.RoundingMode.HALF_UP).intValue();
        return Map.of("application_id",input.path("application_id").asText(),"model_name","test-model",
            "prompt_version","v4","score",score,"summary","Kết quả kiểm thử Java REST API",
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

    private HttpResponse<String> importJdText(String text, boolean withCsrf) throws Exception {
        String boundary="JdImportTestBoundary";
        String body="--"+boundary+"\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\n"+text+"\r\n--"+boundary+"--\r\n";
        var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/recruiter/jobs/ai-parse-jd"))
            .header("Content-Type","multipart/form-data; boundary="+boundary);
        if(withCsrf) {var token=csrf();request.header(token.header(),token.value());}
        return client.send(request.POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    @Test void importedJdIsReviewableWithoutSavingOrInventingMissingFieldsAndRequiresStaffCsrf() throws Exception {
        loginStaff("candidate");
        assertEquals(403,importJdText("Backend developer using Java",true).statusCode());
        loginStaff("recruiter");
        assertEquals(403,importJdText("Backend developer using Java",false).statusCode());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        long before=jdbc.queryForObject("select count(*) from recruitment.jobs",Long.class);
        var response=importJdText("Backend developer using Java",true);
        assertEquals(200,response.statusCode(),response.body());
        var result=mapper.readTree(response.body()).path("data");
        assertEquals("Imported Java JD",result.path("title").asText());
        assertEquals("",result.path("level").asText());
        assertEquals("",result.path("location").asText());
        assertTrue(result.path("departmentId").isNull());
        assertEquals(0,result.at("/criteria/0/weight").asDouble());
        assertEquals(before,jdbc.queryForObject("select count(*) from recruitment.jobs",Long.class));
        assertEquals(400,importJdText("x".repeat(50001),true).statusCode());
    }

    private HttpResponse<String> uploadPdf(byte[] bytes, boolean withCsrf) throws Exception {
        String boundary="PdfTestBoundary";
        var buffer=new java.io.ByteArrayOutputStream();
        buffer.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n").getBytes());
        buffer.write(bytes);buffer.write(("\r\n--"+boundary+"--\r\n").getBytes());
        var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/cv-documents")).header("Content-Type","multipart/form-data; boundary="+boundary);
        if(withCsrf) {var t=csrf();request.header(t.header(),t.value());}
        return client.send(request.POST(HttpRequest.BodyPublishers.ofByteArray(buffer.toByteArray())).build(),HttpResponse.BodyHandlers.ofString());
    }
    @Test void pdfImportsArePrivateCachedAndNeverCreateCvUntilSaved() throws Exception {
        byte[] pdf=("%PDF-1.7\nSynthetic fixture "+UUID.randomUUID()).getBytes();
        assertEquals(401,uploadPdf(pdf,true).statusCode());registerResumeOwner();
        assertEquals(403,uploadPdf(pdf,false).statusCode());
        assertEquals(400,uploadPdf("not a pdf".getBytes(),true).statusCode());
        var large=new byte[2*1024*1024];System.arraycopy(pdf,0,large,0,pdf.length);
        var response=uploadPdf(large,true);assertEquals(200,response.statusCode(),response.body());
        String id=mapper.readTree(response.body()).at("/data/id").asText();
        assertEquals(id,mapper.readTree(uploadPdf(large,true).body()).at("/data/id").asText());
        assertEquals(0,mapper.readTree(get("/api/candidate/resumes").body()).path("data").size());
        assertEquals(403,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),null).statusCode());
        int calls=parseCalls.get();
        var parsed=post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf());assertEquals(200,parsed.statusCode(),parsed.body());
        assertEquals("PARSED",mapper.readTree(parsed.body()).at("/data/status").asText());
        assertEquals(200,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());assertEquals(calls+1,parseCalls.get());
        var body=resumePayload("Reviewed new CV","DRAFT");body.put("sourceDocumentId",id);body.put("extraSections",java.util.List.of(Map.of("title","Research","content","Paper 2023")));
        var saved=post("/api/candidate/resumes",body,csrf());assertEquals(201,saved.statusCode(),saved.body());
        assertEquals("Paper 2023",mapper.readTree(saved.body()).at("/data/extraSections/0/content").asText());
        var file=get("/api/candidate/cv-documents/"+id+"/file");assertEquals(200,file.statusCode());assertEquals("no-store",file.headers().firstValue("Cache-Control").orElse(""));
        assertEquals("SAMEORIGIN",file.headers().firstValue("X-Frame-Options").orElse(""));
        assertEquals("frame-ancestors 'self'",file.headers().firstValue("Content-Security-Policy").orElse(""));
        assertEquals("DENY",get("/api/candidate/resumes").headers().firstValue("X-Frame-Options").orElse(""));
        newBrowserSession();registerResumeOwner();assertEquals(404,get("/api/candidate/cv-documents/"+id).statusCode());assertEquals(404,get("/api/candidate/cv-documents/"+id+"/file").statusCode());
        assertEquals(404,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());
        assertEquals(404,post("/api/candidate/resumes",body,csrf()).statusCode());
    }
    private JsonNode confirmPdf(String id) throws Exception {
        var document=mapper.readTree(get("/api/candidate/cv-documents/"+id).body()).path("data");
        var response=sendResume("PUT","/api/candidate/cv-documents/"+id+"/review",Map.of("content",document.path("parsed"),"version",document.path("reviewVersion").asLong(),"confirm",true),true);
        assertEquals(200,response.statusCode(),response.body());
        return mapper.readTree(response.body()).path("data");
    }
    @Test void pdfSubmissionPinsOriginalAndScoresItsExtractionInsteadOfBuilderEdits() throws Exception {
        String job=applicationJob();
        var upload=uploadPdf(("%PDF-1.7\nfixture "+UUID.randomUUID()).getBytes(),true);
        String doc=mapper.readTree(upload.body()).at("/data/id").asText();
        assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
        var body=resumePayload("CV with PDF","READY");body.put("sourceDocumentId",doc);body.put("summary","Edited in builder, not in original");
        var saved=post("/api/candidate/resumes",body,csrf());assertEquals(201,saved.statusCode(),saved.body());
        var cv=mapper.readTree(saved.body()).path("data");
        var input=new java.util.HashMap<String,Object>(applicationInput(job,cv));input.put("submissionFormat","ORIGINAL_PDF");
        input.put("documentVersion",confirmPdf(doc).path("reviewVersion").asLong());
        var response=post("/api/candidate/applications",input,csrf());assertEquals(201,response.statusCode(),response.body());
        var app=mapper.readTree(response.body()).path("data");String appId=app.path("id").asText();
        assertEquals("ORIGINAL_PDF",app.path("submissionFormat").asText());assertEquals(doc,app.path("sourceDocumentId").asText());
        assertEquals("Original PDF evidence",app.at("/resumeSnapshot/summary").asText());
        assertEquals("Research",app.at("/resumeSnapshot/extraSections/0/title").asText());
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        assertThrows(Exception.class,()->jdbc.update("update recruitment.applications set source_document_id=null where id=?::uuid",appId));
        assertThrows(Exception.class,()->jdbc.update("update candidate.resume_documents set content=? where id=?::uuid","changed".getBytes(),doc));
        newBrowserSession();loginStaff("recruiter");
        var hrPdf=get("/api/recruiter/applications/"+appId+"/cv-file");assertEquals(200,hrPdf.statusCode());
        assertEquals("SAMEORIGIN",hrPdf.headers().firstValue("X-Frame-Options").orElse(""));
        assertEquals(403,get("/api/candidate/cv-documents/"+doc+"/file").statusCode());
        assertEquals(404,get("/api/recruiter/applications/"+UUID.randomUUID()+"/cv-file").statusCode());
    }
    @Test void standalonePdfPinsOptionalConfirmedDataForHrAndAssessment() throws Exception {
        String job=applicationJob();
        var upload=uploadPdf(("%PDF-1.7\nstandalone "+UUID.randomUUID()).getBytes(),true);
        assertEquals(200,upload.statusCode(),upload.body());
        String doc=mapper.readTree(upload.body()).at("/data/id").asText();
        int before=parseCalls.get();
        assertEquals(0,mapper.readTree(get("/api/candidate/resumes").body()).path("data").size());
        assertEquals(403,sendResume("PUT","/api/candidate/cv-documents/"+doc+"/name",Map.of("title","CV riêng Backend"),false).statusCode());
        var renamed=sendResume("PUT","/api/candidate/cv-documents/"+doc+"/name",Map.of("title","CV riêng Backend"),true);
        assertEquals(200,renamed.statusCode(),renamed.body());
        assertEquals("CV riêng Backend",mapper.readTree(renamed.body()).at("/data/title").asText());
        var preferred=sendResume("PUT","/api/candidate/cv-documents/"+doc+"/default",Map.of(),true);
        assertEquals(200,preferred.statusCode(),preferred.body());
        assertTrue(mapper.readTree(preferred.body()).at("/data/isDefault").asBoolean());
        var web=mapper.readTree(post("/api/candidate/resumes",resumePayload("Web CV","READY"),csrf()).body()).path("data");
        var webDefault=sendResume("PUT","/api/candidate/resumes/"+web.path("id").asText()+"/default",Map.of("version",web.path("version").asLong()),true);
        assertEquals(200,webDefault.statusCode(),webDefault.body());
        assertFalse(mapper.readTree(get("/api/candidate/cv-documents/"+doc).body()).at("/data/isDefault").asBoolean());
        assertEquals(200,sendResume("PUT","/api/candidate/cv-documents/"+doc+"/default",Map.of(),true).statusCode());
        assertFalse(mapper.readTree(get("/api/candidate/resumes").body()).at("/data/0/isDefault").asBoolean());
        var input=Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF");
        assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
        var confirmed=confirmPdf(doc);
        var staleInput=new java.util.HashMap<String,Object>(input);staleInput.put("documentVersion",confirmed.path("reviewVersion").asLong()-1);
        assertEquals(409,post("/api/candidate/applications",staleInput,csrf()).statusCode());
        var reviewedInput=new java.util.HashMap<String,Object>(input);reviewedInput.put("documentVersion",confirmed.path("reviewVersion").asLong());
        var submitted=post("/api/candidate/applications",reviewedInput,csrf());
        assertEquals(201,submitted.statusCode(),submitted.body());
        var app=mapper.readTree(submitted.body()).path("data");String appId=app.path("id").asText();
        assertTrue(app.path("resumeId").isNull());
        assertEquals(doc,app.path("sourceDocumentId").asText());
        assertEquals("CV riêng Backend",app.at("/resumeSnapshot/title").asText());
        assertEquals(before+1,parseCalls.get());
        var changed=(tools.jackson.databind.node.ObjectNode)confirmed.path("reviewed").deepCopy();
        changed.put("summary","Changed after submission");
        var updated=sendResume("PUT","/api/candidate/cv-documents/"+doc+"/review",Map.of("content",changed,"version",confirmed.path("reviewVersion").asLong(),"confirm",true),true);
        assertEquals(200,updated.statusCode(),updated.body());
        assertEquals("PENDING",ownAiStatus(appId).path("state").asText());
        var task=claimOnly(appId);
        context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(task);
        assertEquals(before+1,parseCalls.get());
        assertEquals("PARSED",mapper.readTree(get("/api/candidate/cv-documents/"+doc).body()).at("/data/status").asText());
        assertEquals("COMPLETED",ownAiStatus(appId).path("state").asText());
        assertTrue(lastAiRequest.path("resume").toString().contains("Original PDF evidence"));
        assertFalse(lastAiRequest.path("resume").toString().contains("Changed after submission"));
        newBrowserSession();registerResumeOwner();
        assertEquals(404,post("/api/candidate/applications",Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF"),csrf()).statusCode());
        assertEquals(403,get("/api/recruiter/applications/"+appId+"/cv-extraction").statusCode());
        newBrowserSession();loginStaff("recruiter");
        assertEquals(200,get("/api/recruiter/applications/"+appId+"/cv-file").statusCode());
        var extracted=get("/api/recruiter/applications/"+appId+"/cv-extraction");
        assertEquals(200,extracted.statusCode(),extracted.body());
        assertEquals("Original PDF evidence",mapper.readTree(extracted.body()).at("/data/parsed/summary").asText());
        assertEquals(200,get("/api/recruiter/applications/"+appId).statusCode());
        assertEquals(403,get("/api/candidate/cv-documents/"+doc+"/file").statusCode());
    }
    @Test void standalonePdfSubmitsDuringAiOutageThenAddsAnalysisWithoutChangingSubmittedSnapshot() throws Exception {
        String job=applicationJob();
        var upload=uploadPdf(("%PDF-1.7\nunavailable "+UUID.randomUUID()).getBytes(),true);
        String doc=mapper.readTree(upload.body()).at("/data/id").asText();
        var input=Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF");
        var before=parseCalls.get();
        assertEquals(403,post("/api/candidate/applications",input,null).statusCode());
        var tasks=context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class);
        String application;
        JsonNode snapshot;
        try {
            parseFails=true;
            var submitted=post("/api/candidate/applications",input,csrf());
            assertEquals(201,submitted.statusCode(),submitted.body());
            snapshot=mapper.readTree(submitted.body()).path("data");application=snapshot.path("id").asText();
            assertEquals(before,parseCalls.get());
            assertEquals("PENDING",ownAiStatus(application).path("state").asText());
            assertTrue(ownAiStatus(application).path("score").isNull());
            assertEquals(403,get("/api/recruiter/applications/"+application+"/ai-status").statusCode());
            tasks.process(claimOnly(application));
            assertEquals("PENDING",ownAiStatus(application).path("state").asText());
            assertTrue(ownAiStatus(application).path("score").isNull());
            assertEquals(0,mapper.readTree(get("/api/candidate/cv-documents/"+doc).body()).at("/data/attempts").asInt());
            assertEquals(snapshot,mapper.readTree(get("/api/candidate/applications/"+application).body()).path("data"));
            assertEquals(200,get("/api/candidate/cv-documents/"+doc+"/file").statusCode());
            newBrowserSession();loginStaff("recruiter");
            assertEquals(200,get("/api/recruiter/applications/"+application+"/cv-file").statusCode());
            assertEquals("PENDING",mapper.readTree(get("/api/recruiter/applications/"+application+"/ai-status").body()).at("/data/state").asText());
            assertTrue(mapper.readTree(get("/api/recruiter/applications/"+application+"/cv-extraction").body()).at("/data/parsed").isNull());
            var moved=post("/api/recruiter/applications/"+application+"/status",Map.of("status","REVIEWING","version",0),csrf());
            assertEquals(200,moved.statusCode(),moved.body());
        }
        finally {parseFails=false;}
        tasks.process(claimOnly(application));
        var progress=get("/api/recruiter/applications/"+application+"/ai-status");
        assertEquals(200,progress.statusCode(),progress.body());
        assertEquals("no-store",progress.headers().firstValue("Cache-Control").orElse(""));
        assertEquals("COMPLETED",mapper.readTree(progress.body()).at("/data/state").asText());
        assertEquals("REVIEWING",mapper.readTree(get("/api/recruiter/applications/"+application).body()).at("/data/status").asText());
        assertEquals(snapshot.path("resumeSnapshot"),mapper.readTree(get("/api/recruiter/applications/"+application).body()).at("/data/resumeSnapshot"));
        var extracted=mapper.readTree(get("/api/recruiter/applications/"+application+"/cv-extraction").body()).path("data");
        assertEquals("Original PDF evidence",extracted.at("/parsed/summary").asText());
        assertTrue(extracted.path("confirmedAt").isNull());
        assertEquals(403,get("/api/candidate/applications/"+application+"/ai-status").statusCode());
        newBrowserSession();registerResumeOwner();
        assertEquals(404,get("/api/candidate/applications/"+application+"/ai-status").statusCode());
        assertEquals(404,post("/api/candidate/applications",input,csrf()).statusCode());
        newBrowserSession();loginStaff("recruiter");
        assertEquals(404,get("/api/recruiter/applications/"+UUID.randomUUID()+"/ai-status").statusCode());
    }
    @Test void pdfOnlySubmissionsAcceptEveryExtractionStateWithoutWaitingForAi() throws Exception {
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=false").applyTo(context);
        try {
            for(String state:java.util.List.of("UPLOADED","PROCESSING","FAILED","PARSED")) {
                String job=applicationJob();
                String doc=mapper.readTree(uploadPdf(("%PDF-1.7\nstate "+state+UUID.randomUUID()).getBytes(),true).body()).at("/data/id").asText();
                if("PARSED".equals(state)) assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
                else jdbc.update("update candidate.resume_documents set status=? where id=?::uuid",state,doc);
                int before=parseCalls.get();
                var response=post("/api/candidate/applications",Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF"),csrf());
                assertEquals(201,response.statusCode(),response.body());
                assertEquals(before,parseCalls.get());
                var submitted=mapper.readTree(response.body()).path("data");
                assertTrue(submitted.at("/resumeSnapshot/skills").isEmpty());
                assertEquals(409,post("/api/candidate/applications",Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF"),csrf()).statusCode());
                if("PARSED".equals(state)) {
                    var confirmed=confirmPdf(doc);
                    var changed=(tools.jackson.databind.node.ObjectNode)confirmed.path("reviewed").deepCopy();
                    changed.put("summary","Candidate changed this after submitting the original");
                    assertEquals(200,sendResume("PUT","/api/candidate/cv-documents/"+doc+"/review",Map.of("content",changed,"version",confirmed.path("reviewVersion").asLong(),"confirm",true),true).statusCode());
                    String application=submitted.path("id").asText();
                    context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(application));
                    assertEquals("COMPLETED",ownAiStatus(application).path("state").asText());
                    assertEquals(before,parseCalls.get());
                    assertTrue(lastAiRequest.path("resume").toString().contains("Original PDF evidence"));
                    assertFalse(lastAiRequest.path("resume").toString().contains("Candidate changed"));
                    assertEquals(submitted,mapper.readTree(get("/api/candidate/applications/"+application).body()).path("data"));
                    newBrowserSession();loginStaff("recruiter");
                    assertTrue(mapper.readTree(get("/api/recruiter/applications/"+application+"/cv-extraction").body()).at("/data/confirmedAt").isNull());
                }
            }
        } finally {org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=true").applyTo(context);}
    }
    @Test void originalPdfSubmissionDoesNotWaitForAnInFlightParserWrite() throws Exception {
        String job=applicationJob();
        String doc=mapper.readTree(uploadPdf(("%PDF-1.7\nin flight "+UUID.randomUUID()).getBytes(),true).body()).at("/data/id").asText();
        var input=Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF");
        var token=csrf();
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        try(var connection=jdbc.getDataSource().getConnection()) {
            connection.setAutoCommit(false);
            try(var statement=connection.prepareStatement("update candidate.resume_documents set status='PROCESSING' where id=?::uuid")) {
                statement.setString(1,doc);statement.executeUpdate();
                try {
                    var request=HttpRequest.newBuilder(URI.create(baseUrl+"/api/candidate/applications"))
                        .header("Content-Type","application/json").header(token.header(),token.value())
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(input))).build();
                    var response=client.sendAsync(request,HttpResponse.BodyHandlers.ofString()).get(2,java.util.concurrent.TimeUnit.SECONDS);
                    assertEquals(201,response.statusCode(),response.body());
                    assertEquals("PENDING",ownAiStatus(mapper.readTree(response.body()).at("/data/id").asText()).path("state").asText());
                } finally {connection.rollback();}
            }
        }
    }
    @Test void pdfReviewValidatesCorrectionsProtectsEvidenceAndRequiresOwnerCsrfAndCurrentVersion() throws Exception {
        registerResumeOwner();
        String doc=mapper.readTree(uploadPdf(("%PDF-1.7\nreview "+UUID.randomUUID()).getBytes(),true).body()).at("/data/id").asText();
        assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
        var document=mapper.readTree(get("/api/candidate/cv-documents/"+doc).body()).path("data");
        var content=(tools.jackson.databind.node.ObjectNode)document.path("parsed").deepCopy();content.put("email","wrong email");
        var input=new java.util.HashMap<String,Object>();input.put("version",0);input.put("confirm",true);input.put("content",content);
        String path="/api/candidate/cv-documents/"+doc+"/review";
        assertEquals(403,sendResume("PUT",path,input,false).statusCode());
        assertEquals(422,sendResume("PUT",path,input,true).statusCode());
        input.put("confirm",false);
        var draft=sendResume("PUT",path,input,true);assertEquals(200,draft.statusCode(),draft.body());
        assertTrue(mapper.readTree(draft.body()).at("/data/confirmedAt").isNull());
        assertFalse(mapper.readTree(draft.body()).at("/data/issues").isEmpty());
        input.put("confirm",true);assertEquals(409,sendResume("PUT",path,input,true).statusCode());
        input.put("version",1);content.put("email","correct@example.test");
        content.set("experiences",mapper.valueToTree(java.util.List.of(Map.of("company","ABC","position","Developer","startDate","2025-01","endDate","2024-01","current",false,"description","Build API"))));
        assertEquals(422,sendResume("PUT",path,input,true).statusCode());
        content.set("experiences",document.at("/parsed/experiences"));
        content.put("extractedText","forged text");content.set("sources",mapper.valueToTree(java.util.List.of(Map.of("path","email","page",1,"quote","forged","verified",true))));
        var confirmed=sendResume("PUT",path,input,true);assertEquals(200,confirmed.statusCode(),confirmed.body());
        var saved=mapper.readTree(confirmed.body()).path("data");
        assertFalse(saved.path("confirmedAt").isNull());assertEquals("correct@example.test",saved.at("/reviewed/email").asText());
        assertEquals(document.at("/parsed/extractedText"),saved.at("/reviewed/extractedText"));
        assertEquals(document.at("/parsed/sources"),saved.at("/reviewed/sources"));
        assertEquals("cv@example.test",saved.at("/parsed/email").asText());
        input.put("version",2);input.put("confirm",false);
        var unconfirmed=sendResume("PUT",path,input,true);assertEquals(200,unconfirmed.statusCode(),unconfirmed.body());
        assertTrue(mapper.readTree(unconfirmed.body()).at("/data/confirmedAt").isNull());
        newBrowserSession();registerResumeOwner();assertEquals(404,sendResume("PUT",path,input,true).statusCode());
        newBrowserSession();loginStaff("recruiter");assertEquals(403,sendResume("PUT",path,input,true).statusCode());
    }

    @Test void pdfReviewNormalizesOptionalLinksWithoutChangingExtractionAndRejectsInvalidValues() throws Exception {
        registerResumeOwner();
        String id=mapper.readTree(uploadPdf(("%PDF-1.7\nlinks "+UUID.randomUUID()).getBytes(),true).body()).at("/data/id").asText();
        try {
            parseBareLinks=true;
            assertEquals(200,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());
        } finally {parseBareLinks=false;}
        var original=mapper.readTree(get("/api/candidate/cv-documents/"+id).body()).at("/data/parsed");
        var content=(tools.jackson.databind.node.ObjectNode)original.deepCopy();
        content.put("portfolioUrl","portfolio.example.test/work");content.put("githubUrl"," github.com/synthetic ");
        content.put("linkedinUrl","");
        content.set("projects",mapper.valueToTree(java.util.List.of(Map.of("name","Demo","url","demo.example.test/app"))));
        content.set("certifications",mapper.valueToTree(java.util.List.of(Map.of("name","Demo certificate","credentialUrl","cert.example.test/123"))));
        var document=mapper.readTree(get("/api/candidate/cv-documents/"+id).body()).path("data");
        assertTrue(document.path("issues").isEmpty(),document.path("issues").toString());
        var input=new java.util.HashMap<String,Object>();input.put("content",content);input.put("version",0);input.put("confirm",true);
        String path="/api/candidate/cv-documents/"+id+"/review";
        var response=sendResume("PUT",path,input,true);assertEquals(200,response.statusCode(),response.body());
        var saved=mapper.readTree(response.body()).path("data");
        assertEquals("https://portfolio.example.test/work",saved.at("/reviewed/portfolioUrl").asText());
        assertEquals("https://github.com/synthetic",saved.at("/reviewed/githubUrl").asText());
        assertEquals("",saved.at("/reviewed/linkedinUrl").asText());
        assertEquals("https://demo.example.test/app",saved.at("/reviewed/projects/0/url").asText());
        assertEquals("https://cert.example.test/123",saved.at("/reviewed/certifications/0/credentialUrl").asText());
        assertEquals(document.path("parsed"),saved.path("parsed"));
        assertEquals(original.path("sources"),saved.at("/reviewed/sources"));
        input.put("version",1);
        for(String bad:java.util.List.of("javascript:alert(1)","mailto:person@example.test","not a link","https://bad host/path")) {
            content.put("portfolioUrl",bad);
            var rejected=sendResume("PUT",path,input,true);assertEquals(422,rejected.statusCode(),rejected.body());
            assertTrue(rejected.body().contains("Portfolio / Website"));assertTrue(rejected.body().contains("https://"));
        }
        content.put("portfolioUrl","");
        response=sendResume("PUT",path,input,true);assertEquals(200,response.statusCode(),response.body());
        assertEquals("",mapper.readTree(response.body()).at("/data/reviewed/portfolioUrl").asText());
    }

    @Test void pdfParserFailureKeepsOriginalAndDoesNotAttachUnparsedDocument() throws Exception {
        registerResumeOwner();var upload=uploadPdf(("%PDF-1.7\nfixture "+UUID.randomUUID()).getBytes(),true);
        String id=mapper.readTree(upload.body()).at("/data/id").asText();
        try {parseFails=true;assertEquals(503,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());} finally {parseFails=false;}
        assertEquals("FAILED",mapper.readTree(get("/api/candidate/cv-documents/"+id).body()).at("/data/status").asText());
        assertEquals(200,get("/api/candidate/cv-documents/"+id+"/file").statusCode());
        var cv=resumePayload("Unparsed","DRAFT");cv.put("sourceDocumentId",id);
        assertEquals(404,post("/api/candidate/resumes",cv,csrf()).statusCode());
        assertEquals(200,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());
    }

    @Test void pdfParserRateLimitExplainsWaitAndDoesNotExhaustDocumentRetries() throws Exception {
        registerResumeOwner();var upload=uploadPdf(("%PDF-1.7\nfixture "+UUID.randomUUID()).getBytes(),true);
        String id=mapper.readTree(upload.body()).at("/data/id").asText();
        try {
            parseResponseStatus=429;
            for(int attempt=0;attempt<4;attempt++) {
                var response=post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf());
                assertEquals(429,response.statusCode(),response.body());
                assertTrue(response.body().contains("45"));
                assertTrue(response.body().contains("giới hạn API"));
                var doc=mapper.readTree(get("/api/candidate/cv-documents/"+id).body()).path("data");
                assertEquals("FAILED",doc.path("status").asText());assertEquals(0,doc.path("attempts").asInt());
            }
            assertEquals(200,get("/api/candidate/cv-documents/"+id+"/file").statusCode());
        } finally {parseResponseStatus=200;}
        assertEquals(200,post("/api/candidate/cv-documents/"+id+"/parse",Map.of(),csrf()).statusCode());
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

    @Test void pdfOnlyRetirementClosesWritesAndKeepsHistoricalCvAndApplicationReadable() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");
        var submitted=post("/api/candidate/applications",applicationInput(job,cv),csrf());
        assertEquals(201,submitted.statusCode(),submitted.body());
        String application=mapper.readTree(submitted.body()).at("/data/id").asText();
        org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=false").applyTo(context);
        try {
            assertEquals(200,get("/api/candidate/resumes/"+cv.path("id").asText()).statusCode());
            assertEquals(200,get("/api/candidate/applications/"+application).statusCode());
            assertEquals(410,post("/api/candidate/resumes",resumePayload("Retired","READY"),csrf()).statusCode());
            var edit=resumePayload("Retired edit","READY");edit.put("version",cv.path("version").asLong());
            assertEquals(410,sendResume("PUT","/api/candidate/resumes/"+cv.path("id").asText(),edit,true).statusCode());
            assertEquals(410,post("/api/candidate/cv-writing",Map.of("section","summary","action","polish","text","Java","context","Backend"),csrf()).statusCode());
            assertEquals(410,post("/api/candidate/jobs/"+job+"/match",Map.of("resumeId",cv.path("id").asText()),csrf()).statusCode());
            assertEquals(410,post("/api/candidate/applications",applicationInput(job,cv),csrf()).statusCode());
            newBrowserSession();loginStaff("recruiter");
            assertEquals(200,get("/api/recruiter/applications/"+application).statusCode());
        } finally {org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=true").applyTo(context);}
    }
    @Test void pdfMatchRequiresConfirmedOwnedVersionInvalidatesAndReusesForSubmittedAssessment() throws Exception {
        String job=applicationJob();
        String doc=mapper.readTree(uploadPdf(("%PDF-1.7\nPDF only "+UUID.randomUUID()).getBytes(),true).body()).at("/data/id").asText();
        String path="/api/candidate/jobs/"+job+"/match/pdf";
        assertEquals(409,post(path,Map.of("documentId",doc,"documentVersion",0),csrf()).statusCode());
        assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
        assertEquals(409,get(path+"?documentId="+doc).statusCode());
        var confirmed=confirmPdf(doc);long version=confirmed.path("reviewVersion").asLong();
        aiMode="match-ok";aiCalls.set(0);
        org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=false").applyTo(context);
        try {
            assertEquals(403,post(path,Map.of("documentId",doc,"documentVersion",version),null).statusCode());
            assertEquals(409,post(path,Map.of("documentId",doc,"documentVersion",version-1),csrf()).statusCode());
            var response=post(path,Map.of("documentId",doc,"documentVersion",version),csrf());
            assertEquals(200,response.statusCode(),response.body());
            var match=mapper.readTree(response.body()).path("data");
            assertTrue(match.path("resumeId").isNull());assertEquals(doc,match.path("sourceDocumentId").asText());
            assertEquals(version,match.path("documentVersion").asLong());assertEquals(80,match.path("score").asInt());
            for(String key:java.util.List.of("fullName","email","phone","warnings","extractedText","sources"))
                assertTrue(lastAiRequest.path("resume").path(key).isMissingNode(),key);
            assertEquals(200,post(path,Map.of("documentId",doc,"documentVersion",version),csrf()).statusCode());assertEquals(1,aiCalls.get());
            assertEquals(200,get("/api/candidate/jobs/"+job+"/benchmark/pdf?documentId="+doc).statusCode());
            var content=(tools.jackson.databind.node.ObjectNode)confirmed.path("reviewed").deepCopy();content.put("summary","Original PDF evidence plus Java");
            var updated=sendResume("PUT","/api/candidate/cv-documents/"+doc+"/review",Map.of("content",content,"version",version,"confirm",true),true);
            assertEquals(200,updated.statusCode(),updated.body());version++;
            assertTrue(mapper.readTree(get(path+"?documentId="+doc).body()).path("data").isNull());
            assertEquals(200,post(path,Map.of("documentId",doc,"documentVersion",version),csrf()).statusCode());assertEquals(2,aiCalls.get());
            var applied=post("/api/candidate/applications",Map.of("jobId",job,"sourceDocumentId",doc,"submissionFormat","ORIGINAL_PDF","documentVersion",version),csrf());
            assertEquals(201,applied.statusCode(),applied.body());
            String application=mapper.readTree(applied.body()).at("/data/id").asText();
            context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(application));
            assertEquals("COMPLETED",ownAiStatus(application).path("state").asText());assertEquals(2,aiCalls.get());
            newBrowserSession();registerResumeOwner();
            assertEquals(404,get(path+"?documentId="+doc).statusCode());
            assertEquals(404,post(path,Map.of("documentId",doc,"documentVersion",version),csrf()).statusCode());
        } finally {aiMode="ok";org.springframework.boot.test.util.TestPropertyValues.of("app.cv-builder.enabled=true").applyTo(context);}
    }
    @Test void candidateMatchPersistsCacheWithoutApplyingAndOmitsContactData() throws Exception {
        String job=applicationJob();var cv=applicationResume("READY");String path="/api/candidate/jobs/"+job+"/match";
        cv=mapper.readTree(get("/api/candidate/resumes/"+cv.path("id").asText()).body()).path("data");
        aiMode="match-ok";aiCalls.set(0);
        assertTrue(mapper.readTree(get(path+"?resumeId="+cv.path("id").asText()).body()).path("data").isNull());
        var response=post(path,Map.of("resumeId",cv.path("id").asText()),csrf());assertEquals(200,response.statusCode(),response.body());
        var match=mapper.readTree(response.body()).path("data");assertEquals(80,match.path("score").asInt());
        assertEquals(3,match.path("criteria").size());assertEquals("candidate-match-v5",match.path("promptVersion").asText());
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
        var worker=new com.lumi.recruitment.service.AiAnalysisWorker(context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class),1);
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

    private String clarificationPath(String id) {return "/api/candidate/applications/"+id+"/clarifications";}
    private JsonNode generateQuestions(String id) throws Exception {
        var response=post(clarificationPath(id)+"/generate",Map.of(),csrf());
        assertEquals(200,response.statusCode(),response.body());return mapper.readTree(response.body()).path("data");
    }
    private String assessedClarificationApplication() throws Exception {
        aiMode="ok";String id=submittedApplication();
        context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));
        assertEquals("COMPLETED",ownAiStatus(id).path("state").asText());return id;
    }
    @Test void clarificationsAreOptionalCachedGroundedAndVisibleToHrWithoutChangingScores() throws Exception {
        String id=submittedApplication();clarificationCalls.set(0);clarificationMode="ok";aiMode="ok";
        assertEquals("WAITING",generateQuestions(id).path("state").asText());assertEquals(0,clarificationCalls.get());
        context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));
        var original=mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data");
        var score=ownAiStatus(id).path("score");
        var data=generateQuestions(id);assertEquals("READY",data.path("state").asText(),data.toString());
        assertEquals(3,data.path("questions").size());assertEquals(1,clarificationCalls.get());
        assertFalse(lastClarificationRequest.path("resume").has("email"));assertFalse(lastClarificationRequest.path("resume").has("fullName"));
        assertFalse(lastClarificationRequest.has("interview_questions"));assertEquals(3,lastClarificationRequest.path("targets").size());
        assertEquals(data,generateQuestions(id));assertEquals(1,clarificationCalls.get());
        var question=data.at("/questions/0");String path=clarificationPath(id)+"/"+question.path("id").asText();
        assertEquals("Java",question.path("evidence").asText());
        var response=sendResume("PUT",path,Map.of("version",0,"action","ANSWER","answer","Tôi phụ trách API và viết kiểm thử cho dự án cá nhân."),true);
        assertEquals(200,response.statusCode(),response.body());
        assertEquals("ANSWERED",mapper.readTree(response.body()).at("/data/questions/0/responseStatus").asText());
        assertEquals(original,mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data"));assertEquals(score,ownAiStatus(id).path("score"));
        var candidate=client;newBrowserSession();loginStaff("recruiter");
        var hr=get("/api/recruiter/applications/"+id+"/clarifications");assertEquals(200,hr.statusCode(),hr.body());
        assertEquals("no-store",hr.headers().firstValue("Cache-Control").orElse(""));
        var hrData=mapper.readTree(hr.body()).path("data");assertFalse(hrData.path("canEdit").asBoolean());assertFalse(hrData.path("canGenerate").asBoolean());
        assertTrue(hrData.at("/questions/0/answer").asText().contains("kiểm thử"));
        assertEquals(403,sendResume("PUT",path,Map.of("version",1,"action","SKIP"),true).statusCode());
        client=candidate;
    }
    @Test void clarificationAnswersEnforceOwnershipCsrfVersionsAndClosedStages() throws Exception {
        String id=assessedClarificationApplication();var data=generateQuestions(id);String base=clarificationPath(id);
        assertEquals(403,post(base+"/generate",Map.of(),null).statusCode());
        String path=base+"/"+data.at("/questions/0/id").asText();var owner=client;
        assertEquals(403,sendResume("PUT",path,Map.of("version",0,"action","ANSWER","answer","Test"),false).statusCode());
        assertEquals(400,sendResume("PUT",path,Map.of("version",0,"action","ANSWER","answer","   "),true).statusCode());
        assertEquals(400,sendResume("PUT",path,Map.of("version",0,"action","ANSWER","answer","x".repeat(3001)),true).statusCode());
        assertEquals(404,sendResume("PUT",base+"/"+UUID.randomUUID(),Map.of("version",0,"action","SKIP"),true).statusCode());
        newBrowserSession();registerResumeOwner();assertEquals(404,get(base).statusCode());assertEquals(404,post(base+"/generate",Map.of(),csrf()).statusCode());
        assertEquals(404,sendResume("PUT",path,Map.of("version",0,"action","SKIP"),true).statusCode());
        assertEquals(403,get("/api/recruiter/applications/"+id+"/clarifications").statusCode());
        newBrowserSession();assertEquals(401,get(base).statusCode());client=owner;
        var saved=sendResume("PUT",path,Map.of("version",0,"action","ANSWER","answer","Kinh nghiệm dự án thực tế."),true);assertEquals(200,saved.statusCode());
        assertEquals(409,sendResume("PUT",path,Map.of("version",0,"action","SKIP"),true).statusCode());
        var skipped=sendResume("PUT",path,Map.of("version",1,"action","SKIP","answer","Không được lưu nội dung này"),true);
        assertEquals(200,skipped.statusCode());assertEquals("",mapper.readTree(skipped.body()).at("/data/questions/0/answer").asText());
        assertEquals("SKIPPED",mapper.readTree(skipped.body()).at("/data/questions/0/responseStatus").asText());
        assertEquals(200,sendResume("PUT",path,Map.of("version",2,"action","ANSWER","answer","Bổ sung lại sau khi bỏ qua."),true).statusCode());
        newBrowserSession();loginStaff("recruiter");assertEquals(200,changeStage(id,"REJECTED",0,"Không phù hợp vị trí").statusCode());client=owner;
        assertFalse(mapper.readTree(get(base).body()).at("/data/canEdit").asBoolean());
        assertEquals(409,sendResume("PUT",path,Map.of("version",3,"action","SKIP"),true).statusCode());
        assertEquals(409,post(base+"/generate",Map.of(),csrf()).statusCode());
    }
    @Test void clarificationFailuresAreRetryableBoundedAndNeverStoreInvalidQuestions() throws Exception {
        String id=assessedClarificationApplication();var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        clarificationCalls.set(0);
        try {
            clarificationMode="unavailable";assertEquals("FAILED",generateQuestions(id).path("state").asText());
            assertFalse(generateQuestions(id).path("canGenerate").asBoolean());assertEquals(1,clarificationCalls.get());
            jdbc.update("update recruitment.application_clarification_sets set retry_at=now()-interval '1 second' where application_id=?::uuid",id);
            clarificationMode="invalid";var failed=generateQuestions(id);assertEquals("FAILED",failed.path("state").asText());assertEquals(0,failed.path("questions").size());
            jdbc.update("update recruitment.application_clarification_sets set retry_at=now()-interval '1 second' where application_id=?::uuid",id);
            assertEquals("FAILED",generateQuestions(id).path("state").asText());assertEquals(3,clarificationCalls.get());
            jdbc.update("update recruitment.application_clarification_sets set retry_at=now()-interval '1 second' where application_id=?::uuid",id);
            clarificationMode="ok";assertEquals("FAILED",generateQuestions(id).path("state").asText());assertEquals(3,clarificationCalls.get());
            jdbc.update("update recruitment.application_clarification_sets set window_started_at=now()-interval '2 hours' where application_id=?::uuid",id);
            assertEquals("READY",generateQuestions(id).path("state").asText());assertEquals(4,clarificationCalls.get());
        } finally {clarificationMode="ok";}
    }
    @Test void clarificationConcurrentRequestsUseOneLeaseAndExpiredLeaseCanRecover() throws Exception {
        String id=assessedClarificationApplication();var token=csrf();clarificationCalls.set(0);clarificationMode="hold";
        clarificationEntered=new java.util.concurrent.CountDownLatch(1);clarificationRelease=new java.util.concurrent.CountDownLatch(1);
        var request=HttpRequest.newBuilder(URI.create(baseUrl+clarificationPath(id)+"/generate")).header("Content-Type","application/json")
            .header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString("{}")).build();
        var first=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
        try {
            assertTrue(clarificationEntered.await(3,java.util.concurrent.TimeUnit.SECONDS));
            assertEquals("GENERATING",generateQuestions(id).path("state").asText());assertEquals(1,clarificationCalls.get());
            clarificationRelease.countDown();var done=first.get(3,java.util.concurrent.TimeUnit.SECONDS);assertEquals("READY",mapper.readTree(done.body()).at("/data/state").asText());
        } finally {clarificationRelease.countDown();clarificationMode="ok";}
        String second=assessedClarificationApplication();
        var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("""
            insert into recruitment.application_clarification_sets(application_id,assessment_id,state,lease_token,lease_until,retry_at,attempts)
            select application_id,id,'GENERATING',gen_random_uuid(),now()-interval '1 minute',now()-interval '1 minute',1 from recruitment.ai_assessments where application_id=?::uuid
            """,second);
        assertEquals("READY",generateQuestions(second).path("state").asText());assertEquals(2,clarificationCalls.get());
    }
    @Test void clarificationDoesNotCallAiWhenAllRequirementsAlreadyHaveEvidence() throws Exception {
        String id=submittedApplication();clarificationCalls.set(0);aiMode="all-matched";
        try {context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));}
        finally {aiMode="ok";}
        assertEquals("NOT_NEEDED",generateQuestions(id).path("state").asText());
        assertEquals("NOT_NEEDED",generateQuestions(id).path("state").asText());assertEquals(0,clarificationCalls.get());
    }
    @Test void clarificationExplainsFailedOrLegacyAnalysisInsteadOfWaitingForever() throws Exception {
        String id=submittedApplication();var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        jdbc.update("update recruitment.ai_analysis_tasks set status='FAILED' where application_id=?::uuid",id);
        var data=generateQuestions(id);assertEquals("NEEDS_ANALYSIS",data.path("state").asText());assertFalse(data.path("canGenerate").asBoolean());
    }

    @Test void clarificationPdfUsesSubmittedSourceAndDoesNotParseAgainOrUseLaterEdits() throws Exception {
        aiMode="ok";clarificationMode="ok";
        for(boolean confirmed:java.util.List.of(false,true)) {
            newBrowserSession();String job=applicationJob();
            var uploaded=uploadPdf(("%PDF-1.7\nclarification "+UUID.randomUUID()).getBytes(),true);
            assertEquals(200,uploaded.statusCode());String doc=mapper.readTree(uploaded.body()).at("/data/id").asText();
            var input=new java.util.HashMap<String,Object>();input.put("jobId",job);input.put("sourceDocumentId",doc);input.put("submissionFormat","ORIGINAL_PDF");
            JsonNode reviewed=null;
            if(confirmed) {
                assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());
                reviewed=confirmPdf(doc);input.put("documentVersion",reviewed.path("reviewVersion").asLong());
            }
            var submitted=post("/api/candidate/applications",input,csrf());assertEquals(201,submitted.statusCode(),submitted.body());
            String id=mapper.readTree(submitted.body()).at("/data/id").asText();
            context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));
            int parsed=parseCalls.get();
            if(reviewed==null) reviewed=confirmPdf(doc);
            var changed=(tools.jackson.databind.node.ObjectNode)reviewed.path("reviewed").deepCopy();changed.put("summary","LATER EDIT MUST NOT LEAK");
            assertEquals(200,sendResume("PUT","/api/candidate/cv-documents/"+doc+"/review",Map.of("content",changed,"version",reviewed.path("reviewVersion").asLong(),"confirm",true),true).statusCode());
            assertEquals("READY",generateQuestions(id).path("state").asText());
            assertEquals(parsed,parseCalls.get());assertEquals("Original PDF evidence",lastClarificationRequest.at("/resume/summary").asText());
            assertFalse(lastClarificationRequest.toString().contains("LATER EDIT"));
        }
    }

    private String scorecardPath(String id) {return "/api/recruiter/applications/"+id+"/scorecard";}
    private void moveToInterview(String id) throws Exception {
        var application=review(id).path("application");
        if("SUBMITTED".equals(application.path("status").asText())) {
            var response=changeStage(id,"REVIEWING",application.path("version").asLong(),"HR bắt đầu sơ tuyển");
            assertEquals(200,response.statusCode(),response.body());application=mapper.readTree(response.body()).path("data").path("application");
        }
        if("REVIEWING".equals(application.path("status").asText())) {
            var response=changeStage(id,"INTERVIEW",application.path("version").asLong(),"HR duyệt sơ tuyển và mời phỏng vấn");
            assertEquals(200,response.statusCode(),response.body());
        }
        assertEquals("INTERVIEW",review(id).at("/application/status").asText());
    }
    private JsonNode generateScorecard(String id) throws Exception {
        var response=post(scorecardPath(id)+"/generate",Map.of(),csrf());assertEquals(201,response.statusCode(),response.body());
        return mapper.readTree(response.body()).path("data");
    }
    private Map<String,Object> scorecardInput(JsonNode card,String status) {
        var input=new java.util.HashMap<String,Object>();input.put("version",card.path("version").asLong());input.put("sections",card.path("sections"));input.put("status",status);return input;
    }
    @Test void scorecardOnlyAllowsInterviewMutationsAndPreservesSavedCardsAtEveryOtherStage() throws Exception {
        String id=assessedClarificationApplication();newBrowserSession();loginStaff("recruiter");
        String path=scorecardPath(id);var jdbc=context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
        var stages=java.util.List.of("SUBMITTED","REVIEWING","OFFER","HIRED","REJECTED","WITHDRAWN");
        scorecardCalls.set(0);
        // Test every persisted stage, including WITHDRAWN which has no candidate UI yet.
        for(String stage:stages) {
            jdbc.update("update recruitment.applications set status=? where id=?::uuid",stage,id);
            for(boolean force:java.util.List.of(false,true)) {
                var response=post(path+"/generate",Map.of("force",force),csrf());
                assertEquals(409,response.statusCode(),stage+": "+response.body());assertTrue(response.body().contains("Phỏng vấn"));
            }
            assertEquals(409,sendResume("PUT",path,Map.of("version",0,"status","DRAFT","sections",java.util.List.of()),true).statusCode());
            assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        }
        assertEquals(0,scorecardCalls.get());
        jdbc.update("update recruitment.applications set status='INTERVIEW' where id=?::uuid",id);
        var card=generateScorecard(id);var changed=card.deepCopy();
        ((tools.jackson.databind.node.ObjectNode)changed.at("/sections/0/questions/0")).put("score",4).put("notes","Biên bản HR cần giữ nguyên");
        var response=sendResume("PUT",path,scorecardInput(changed,"DRAFT"),true);assertEquals(200,response.statusCode(),response.body());
        var saved=mapper.readTree(response.body()).path("data");
        for(String stage:stages) {
            jdbc.update("update recruitment.applications set status=? where id=?::uuid",stage,id);
            assertEquals(saved,mapper.readTree(get(path).body()).path("data"));
            for(boolean force:java.util.List.of(false,true)) assertEquals(409,post(path+"/generate",Map.of("force",force),csrf()).statusCode());
            for(String status:java.util.List.of("DRAFT","COMPLETED")) assertEquals(409,sendResume("PUT",path,scorecardInput(saved,status),true).statusCode());
            assertEquals(saved,mapper.readTree(get(path).body()).path("data"));
        }
        assertEquals(1,scorecardCalls.get());
    }

    @Test void scorecardCannotPersistQuestionsIfHrChangesStageWhileAiIsRunning() throws Exception {
        for(boolean regenerate:java.util.List.of(false,true)) {
            newBrowserSession();String id=assessedClarificationApplication();newBrowserSession();loginStaff("recruiter");moveToInterview(id);
            JsonNode original=regenerate?generateScorecard(id):null;
            scorecardEntered=new java.util.concurrent.CountDownLatch(1);scorecardRelease=new java.util.concurrent.CountDownLatch(1);scorecardMode="hold";
            var token=csrf();var request=HttpRequest.newBuilder(URI.create(baseUrl+scorecardPath(id)+"/generate"))
                .header("Content-Type","application/json").header(token.header(),token.value())
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("force",regenerate)))).build();
            var pending=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
            try {
                assertTrue(scorecardEntered.await(3,java.util.concurrent.TimeUnit.SECONDS));
                var application=review(id).path("application");
                var moved=changeStage(id,"REJECTED",application.path("version").asLong(),"HR kết thúc phỏng vấn");
                assertEquals(200,moved.statusCode(),moved.body());
                scorecardRelease.countDown();var response=pending.get(3,java.util.concurrent.TimeUnit.SECONDS);
                assertEquals(409,response.statusCode(),response.body());assertTrue(response.body().contains("Phỏng vấn"));
                var stored=mapper.readTree(get(scorecardPath(id)).body()).path("data");
                if(original==null) assertTrue(stored.isNull()); else assertEquals(original,stored);
                assertEquals("REJECTED",review(id).at("/application/status").asText());
            } finally {scorecardRelease.countDown();scorecardMode="ok";}
        }
    }

    @Test void scorecardUsesClarificationAnswersAndProtectsRatedCompletedAndVersionedData() throws Exception {
        String id=assessedClarificationApplication();var clarification=generateQuestions(id);
        String qid=clarification.at("/questions/0/id").asText();
        assertEquals(200,sendResume("PUT",clarificationPath(id)+"/"+qid,Map.of("version",0,"action","ANSWER","answer","Tôi phụ trách transaction và kiểm thử."),true).statusCode());
        var before=mapper.readTree(get("/api/candidate/applications/"+id).body()).path("data");
        newBrowserSession();loginStaff("recruiter");moveToInterview(id);before=review(id).path("application");scorecardCalls.set(0);var card=generateScorecard(id);
        assertEquals(2,card.path("sections").size());assertEquals(1,scorecardCalls.get());
        assertEquals("Ứng viên",lastScorecardRequest.path("candidate_name").asText());
        assertEquals("Tôi phụ trách transaction và kiểm thử.",lastScorecardRequest.at("/clarifications/0/answer").asText());
        assertEquals(card,generateScorecard(id));assertEquals(1,scorecardCalls.get());
        String path=scorecardPath(id);
        assertEquals(403,sendResume("PUT",path,scorecardInput(card,"DRAFT"),false).statusCode());
        assertEquals(400,sendResume("PUT",path,scorecardInput(card,"COMPLETED"),true).statusCode());
        var forged=card.deepCopy();((tools.jackson.databind.node.ObjectNode)forged.at("/sections/0/questions/0")).put("question","Forged question");
        assertEquals(400,sendResume("PUT",path,scorecardInput(forged,"DRAFT"),true).statusCode());
        var rated=card.deepCopy();((tools.jackson.databind.node.ObjectNode)rated.at("/sections/0/questions/0")).put("score",6);
        assertEquals(400,sendResume("PUT",path,scorecardInput(rated,"DRAFT"),true).statusCode());
        ((tools.jackson.databind.node.ObjectNode)rated.at("/sections/0/questions/0")).put("score",4);
        var saved=sendResume("PUT",path,scorecardInput(rated,"DRAFT"),true);assertEquals(200,saved.statusCode(),saved.body());
        var draft=mapper.readTree(saved.body()).path("data");assertEquals(4,draft.path("overallScore").asInt());assertEquals(1,draft.path("version").asInt());
        assertEquals(409,sendResume("PUT",path,scorecardInput(card,"DRAFT"),true).statusCode());
        assertEquals(409,post(path+"/generate",Map.of("force",true),csrf()).statusCode());assertEquals(1,scorecardCalls.get());
        var completed=draft.deepCopy();for(var section:completed.path("sections"))for(var q:section.path("questions"))((tools.jackson.databind.node.ObjectNode)q).put("score",5);
        var input=scorecardInput(completed,"COMPLETED");input.put("recommendation","HIRE");input.put("overallNotes","Biên bản kiểm thử của HR.");
        var done=sendResume("PUT",path,input,true);assertEquals(200,done.statusCode(),done.body());
        var result=mapper.readTree(done.body()).path("data");assertEquals("COMPLETED",result.path("status").asText());assertEquals(5,result.path("overallScore").asInt());
        assertEquals(409,post(path+"/generate",Map.of("force",true),csrf()).statusCode());
        assertEquals(409,sendResume("PUT",path,scorecardInput(result,"DRAFT"),true).statusCode());
        assertEquals(result,mapper.readTree(get(path).body()).path("data"));
        assertEquals(before,review(id).path("application"));
        newBrowserSession();registerResumeOwner();assertEquals(403,get(path).statusCode());
        assertEquals(403,post(path+"/generate",Map.of(),csrf()).statusCode());
        assertEquals(403,sendResume("PUT",path,input,true).statusCode());
    }
    @Test void scorecardGenerationCannotOverwriteHrSaveWhileAiIsRunning() throws Exception {
        String id=assessedClarificationApplication();newBrowserSession();loginStaff("recruiter");moveToInterview(id);var card=generateScorecard(id);
        scorecardEntered=new java.util.concurrent.CountDownLatch(1);scorecardRelease=new java.util.concurrent.CountDownLatch(1);scorecardMode="hold";
        var token=csrf();var request=HttpRequest.newBuilder(URI.create(baseUrl+scorecardPath(id)+"/generate")).header("Content-Type","application/json").header(token.header(),token.value()).POST(HttpRequest.BodyPublishers.ofString("{\"force\":true}")).build();
        var pending=client.sendAsync(request,HttpResponse.BodyHandlers.ofString());
        try {
            assertTrue(scorecardEntered.await(3,java.util.concurrent.TimeUnit.SECONDS));
            var changed=card.deepCopy();((tools.jackson.databind.node.ObjectNode)changed.at("/sections/0/questions/0")).put("notes","Nội dung HR cần được giữ.");
            var saved=sendResume("PUT",scorecardPath(id),scorecardInput(changed,"DRAFT"),true);assertEquals(200,saved.statusCode(),saved.body());
            scorecardRelease.countDown();var response=pending.get(3,java.util.concurrent.TimeUnit.SECONDS);assertEquals(409,response.statusCode(),response.body());
            assertEquals("Nội dung HR cần được giữ.",mapper.readTree(get(scorecardPath(id)).body()).at("/data/sections/0/questions/0/notes").asText());
        } finally {scorecardRelease.countDown();scorecardMode="ok";}
    }
    @Test void scorecardInvalidOrUnavailableAiDoesNotStorePartialCardsAndPristineRegenerationIsSafe() throws Exception {
        String id=assessedClarificationApplication();newBrowserSession();loginStaff("recruiter");moveToInterview(id);String path=scorecardPath(id);
        try {
            for(String mode:java.util.List.of("invalid","unavailable")) {
                scorecardMode=mode;assertEquals(503,post(path+"/generate",Map.of(),csrf()).statusCode());assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
            }
            scorecardMode="ok";var card=generateScorecard(id);
            var regenerated=post(path+"/generate",Map.of("force",true),csrf());assertEquals(201,regenerated.statusCode());
            var result=mapper.readTree(regenerated.body()).path("data");assertEquals(card.path("version").asInt()+1,result.path("version").asInt());
            assertEquals("DRAFT",result.path("status").asText());assertTrue(result.path("overallScore").isNull());
        } finally {scorecardMode="ok";}
    }
    @Test void githubSourceUsesImmutablePdfExtractionForBothDirectAndConfirmedSubmissions() throws Exception {
        for(boolean confirm:java.util.List.of(false,true)) {
            newBrowserSession();String job=applicationJob();var upload=uploadPdf(("%PDF-1.7\nsource "+UUID.randomUUID()).getBytes(),true);
            String doc=mapper.readTree(upload.body()).at("/data/id").asText();var input=new java.util.HashMap<String,Object>();input.put("jobId",job);input.put("sourceDocumentId",doc);input.put("submissionFormat","ORIGINAL_PDF");
            JsonNode reviewed=null;
            if(confirm){assertEquals(200,post("/api/candidate/cv-documents/"+doc+"/parse",Map.of(),csrf()).statusCode());reviewed=confirmPdf(doc);input.put("documentVersion",reviewed.path("reviewVersion").asLong());}
            var submitted=post("/api/candidate/applications",input,csrf());assertEquals(201,submitted.statusCode());String id=mapper.readTree(submitted.body()).at("/data/id").asText();var owner=client;String path="/api/recruiter/applications/"+id+"/github-source";
            assertEquals(403,get(path).statusCode());
            if(!confirm){newBrowserSession();loginStaff("recruiter");assertEquals("PENDING",mapper.readTree(get(path).body()).at("/data/state").asText());client=owner;}
            context.getBean(com.lumi.recruitment.service.AiAnalysisTaskService.class).process(claimOnly(id));int parsed=parseCalls.get();
            if(reviewed==null)reviewed=confirmPdf(doc);
            var changed=(tools.jackson.databind.node.ObjectNode)reviewed.path("reviewed").deepCopy();changed.put("githubUrl","https://github.com/later-edit");
            assertEquals(200,sendResume("PUT","/api/candidate/cv-documents/"+doc+"/review",Map.of("version",reviewed.path("reviewVersion").asLong(),"content",changed,"confirm",true),true).statusCode());
            newBrowserSession();loginStaff("recruiter");var response=get(path);assertEquals(200,response.statusCode());
            assertEquals("READY",mapper.readTree(response.body()).at("/data/state").asText());assertEquals("https://github.com/test",mapper.readTree(response.body()).at("/data/url").asText());assertEquals(parsed,parseCalls.get());
            moveToInterview(id);var card=generateScorecard(id);assertEquals(2,card.path("sections").size());assertEquals("Original PDF evidence",lastScorecardRequest.path("cv_summary").asText());assertEquals(parsed,parseCalls.get());
        }
    }

    @Test void githubVerificationPersistsCacheAndFeedsScorecardWithoutChangingApplication() throws Exception {
        String id=assessedClarificationApplication();newBrowserSession();loginStaff("recruiter");String path="/api/recruiter/applications/"+id+"/github-verification";
        moveToInterview(id);
        var original=review(id).path("application");githubCalls.set(0);
        assertTrue(mapper.readTree(get(path).body()).path("data").isNull());
        assertEquals(403,post(path,Map.of(),null).statusCode());assertEquals(0,githubCalls.get());
        var verified=post(path,Map.of(),csrf());assertEquals(201,verified.statusCode(),verified.body());
        var data=mapper.readTree(verified.body()).path("data");assertEquals("test",data.path("githubUsername").asText());assertEquals(7,data.path("codeQualityScore").asInt());
        assertEquals("https://github.com/test",lastGithubRequest.path("github_url").asText());assertFalse(lastGithubRequest.has("email"));
        assertEquals(data,mapper.readTree(post(path,Map.of(),csrf()).body()).path("data"));assertEquals(1,githubCalls.get());
        generateScorecard(id);assertEquals("Docker",lastScorecardRequest.at("/github_unverified_skills/0").asText());
        assertEquals(original,review(id).path("application"));
        newBrowserSession();registerResumeOwner();assertEquals(403,get(path).statusCode());assertEquals(403,post(path,Map.of(),csrf()).statusCode());
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
