package com.lumi.recruitment;

import com.lumi.recruitment.entity.auth.User;
import com.lumi.recruitment.entity.auth.UserRole;
import com.lumi.recruitment.entity.candidate.CandidateProfile;
import com.lumi.recruitment.repository.CandidateProfileRepository;
import com.lumi.recruitment.repository.UserRepository;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "LUMI_TEST_POSTGRES_URL", matches = ".+")
class AccountSchemaMigrationTest {

    private String databaseName;
    private String databaseUrl;
    private Connection connection;
    private Flyway flyway;
    private final String username = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_USER", "postgres");
    private final String password = System.getenv().getOrDefault("LUMI_TEST_POSTGRES_PASSWORD", "");

    @BeforeEach
    void createIsolatedDatabase() throws SQLException {
        String adminUrl = System.getenv("LUMI_TEST_POSTGRES_URL");
        databaseName = "lumi_schema_test_" + UUID.randomUUID().toString().replace("-", "");
        try (var admin = DriverManager.getConnection(adminUrl, username, password);
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + databaseName);
        }
        databaseUrl = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + databaseName;
        connection = DriverManager.getConnection(databaseUrl, username, password);
        execute("SET search_path TO pg_catalog");
        flyway = Flyway.configure()
                .dataSource(databaseUrl, username, password)
                .defaultSchema("public")
                .schemas("public")
                .locations("classpath:db/migration")
                .target("1")
                .baselineVersion("0")
                .baselineOnMigrate(false)
                .cleanDisabled(true)
                .load();
    }

    @AfterEach
    void dropIsolatedDatabase() throws SQLException {
        if (connection != null) connection.close();
        if (databaseName != null) {
            try (var admin = DriverManager.getConnection(System.getenv("LUMI_TEST_POSTGRES_URL"), username, password);
                 var statement = admin.createStatement()) {
                statement.execute("DROP DATABASE IF EXISTS " + databaseName);
            }
        }
    }

    @Test
    void upgradesV8WithoutChangingUsersProfilesResumesOrJobs() throws Exception {
        Flyway prior=Flyway.configure().dataSource(databaseUrl,username,password).defaultSchema("public").locations("classpath:db/migration").target("8").load();
        assertEquals(8,prior.migrate().migrationsExecuted);
        String candidate=UUID.randomUUID().toString(), staff=UUID.randomUUID().toString(), resume=UUID.randomUUID().toString(), job=UUID.randomUUID().toString(), dept=UUID.randomUUID().toString();
        execute("INSERT INTO auth.users(id,email,full_name,password_hash,role,status) VALUES ('"+candidate+"','before@example.test','Before','hash','CANDIDATE','ACTIVE'),('"+staff+"','staff@example.test','Staff','hash','RECRUITER','ACTIVE')");
        execute("INSERT INTO candidate.candidate_profiles(user_id) VALUES ('"+candidate+"')");
        execute("INSERT INTO candidate.resumes(id,candidate_id,title,template,status,created_at,updated_at) VALUES ('"+resume+"','"+candidate+"','Existing CV','classic','DRAFT',now(),now())");
        execute("INSERT INTO recruitment.departments(id,name) VALUES ('"+dept+"','Existing department')");
        execute("INSERT INTO recruitment.jobs(id,department_id,created_by,title,description,requirements,benefits,location,employment_type,work_mode,experience_level) VALUES ('"+job+"','"+dept+"','"+staff+"','Existing job','Keep','Keep','','Đà Nẵng','FULL_TIME','HYBRID','JUNIOR')");
        var tables=java.util.List.of("auth.users","candidate.candidate_profiles","candidate.resumes","recruitment.departments","recruitment.jobs");
        var before=new java.util.HashMap<String,String>();
        for(String table:tables)before.put(table,scalar("SELECT jsonb_agg(to_jsonb(t))::text FROM "+table+" t"));
        Flyway latest=Flyway.configure().dataSource(databaseUrl,username,password).defaultSchema("public").locations("classpath:db/migration").target("13").load();
        assertEquals(5,latest.migrate().migrationsExecuted);assertEquals(0,latest.migrate().migrationsExecuted);
        for(String table:tables)assertEquals(before.get(table),scalar("SELECT jsonb_agg(to_jsonb(t))::text FROM "+table+" t"));
        assertEquals("recruitment.applications",scalar("SELECT to_regclass('recruitment.applications')::text"));
        assertEquals("0",scalar("SELECT count(*)::text FROM recruitment.applications"));
    }

    @Test
    void upgradesV12PreservingRecruiterProfilesAndAddingVersion() throws Exception {
        assertEquals(12,migrateTo("12"));
        String staff=UUID.randomUUID().toString(), dept=UUID.randomUUID().toString();
        execute("INSERT INTO auth.users(id,email,full_name,password_hash,role,status) VALUES ('"+staff+"','profile@example.test','HR','hash','RECRUITER','ACTIVE')");
        execute("INSERT INTO recruitment.departments(id,name) VALUES ('"+dept+"','HR')");
        execute("INSERT INTO recruitment.recruiter_profiles(user_id,employee_code,phone,job_title,department_id,avatar_url) VALUES ('"+staff+"','HR001','0900123456','Recruiter','"+dept+"','https://example.test/avatar.png')");
        String before=scalar("SELECT to_jsonb(p)::text FROM recruitment.recruiter_profiles p WHERE user_id='"+staff+"'");
        assertEquals(1,migrateTo("13"));assertEquals(0,migrateTo("13"));
        assertEquals(before,scalar("SELECT (to_jsonb(p)-'version')::text FROM recruitment.recruiter_profiles p WHERE user_id='"+staff+"'"));
        assertEquals("0",scalar("SELECT version::text FROM recruitment.recruiter_profiles WHERE user_id='"+staff+"'"));
        assertSqlState("23514","UPDATE recruitment.recruiter_profiles SET version=-1 WHERE user_id='"+staff+"'");
    }

    @Test
    void upgradesV11PreservingAssessmentsAndAllowingFractionalWeights() throws Exception {
        Flyway prior=Flyway.configure().dataSource(databaseUrl,username,password).defaultSchema("public").locations("classpath:db/migration").target("11").load();
        assertEquals(11,prior.migrate().migrationsExecuted);
        String candidate=UUID.randomUUID().toString(), staff=UUID.randomUUID().toString(), resume=UUID.randomUUID().toString(), job=UUID.randomUUID().toString(), dept=UUID.randomUUID().toString(), app=UUID.randomUUID().toString(), event=UUID.randomUUID().toString();
        execute("INSERT INTO auth.users(id,email,full_name,password_hash,role,status) VALUES ('"+candidate+"','v9candidate@example.test','Candidate','hash','CANDIDATE','ACTIVE'),('"+staff+"','v9staff@example.test','HR','hash','RECRUITER','ACTIVE')");
        execute("INSERT INTO candidate.candidate_profiles(user_id) VALUES ('"+candidate+"')");
        execute("INSERT INTO candidate.resumes(id,candidate_id,title,template,status,full_name,email,desired_position,created_at,updated_at) VALUES ('"+resume+"','"+candidate+"','Existing CV','classic','READY','Candidate','v9candidate@example.test','Developer',now(),now())");
        execute("INSERT INTO recruitment.departments(id,name) VALUES ('"+dept+"','V9 department')");
        execute("INSERT INTO recruitment.jobs(id,department_id,created_by,title,description,requirements,benefits,location,employment_type,work_mode,experience_level) VALUES ('"+job+"','"+dept+"','"+staff+"','V9 job','Keep','Keep','','Đà Nẵng','FULL_TIME','HYBRID','JUNIOR')");
        execute("INSERT INTO recruitment.applications(id,job_id,candidate_id,resume_id,status,job_version,job_snapshot,applied_at,updated_at) VALUES ('"+app+"','"+job+"','"+candidate+"','"+resume+"','SUBMITTED',0,'{\"title\":\"Saved JD\"}',now(),now())");
        execute("INSERT INTO recruitment.application_resume_snapshots(application_id,source_resume_version,content,captured_at) VALUES ('"+app+"',0,'{\"title\":\"Saved CV\"}',now())");
        execute("INSERT INTO recruitment.application_status_history(id,application_id,to_status,changed_by,created_at) VALUES ('"+event+"','"+app+"','SUBMITTED','"+candidate+"',now())");

        String assessment=UUID.randomUUID().toString(), criterion=UUID.randomUUID().toString();
        execute("INSERT INTO recruitment.ai_assessments(id,application_id,model_name,score,summary) VALUES ('"+assessment+"','"+app+"','old-model',70,'Preserve result')");
        execute("INSERT INTO recruitment.ai_assessment_criteria(id,assessment_id,skill,match_level,points,weight) VALUES ('"+criterion+"','"+assessment+"','Java','PARTIAL',70,10)");
        String before=scalar("SELECT jsonb_agg(to_jsonb(t))::text FROM recruitment.ai_assessments t");
        assertEquals(1,migrateTo("12"));assertEquals(0,migrateTo("12"));
        assertEquals(before,scalar("SELECT jsonb_agg(to_jsonb(t))::text FROM recruitment.ai_assessments t"));
        assertEquals("10.00",scalar("SELECT weight::text FROM recruitment.ai_assessment_criteria WHERE id='"+criterion+"'"));
        String next=UUID.randomUUID().toString();
        execute("INSERT INTO recruitment.ai_assessment_criteria(assessment_id,criterion_key,skill,match_level,points,weight) VALUES ('"+assessment+"','criterion:"+next+"','Education','PARTIAL',80,25.5)");
        assertEquals("25.50",scalar("SELECT weight::text FROM recruitment.ai_assessment_criteria WHERE criterion_key='criterion:"+next+"'"));
        assertThrows(SQLException.class,()->execute("INSERT INTO recruitment.ai_assessment_criteria(assessment_id,criterion_key,skill,match_level,points,weight) VALUES ('"+assessment+"','criterion:"+next+"','Duplicate','PARTIAL',80,25.5)"));
        assertThrows(SQLException.class,()->execute("UPDATE recruitment.ai_assessment_criteria SET weight=0 WHERE id='"+criterion+"'"));
    }

    @Test
    void upgradesV9PreservingSubmittedEvidenceAndAudit() throws Exception {
        Flyway prior=Flyway.configure().dataSource(databaseUrl,username,password).defaultSchema("public").locations("classpath:db/migration").target("9").load();
        assertEquals(9,prior.migrate().migrationsExecuted);
        String candidate=UUID.randomUUID().toString(), staff=UUID.randomUUID().toString(), resume=UUID.randomUUID().toString(), job=UUID.randomUUID().toString(), dept=UUID.randomUUID().toString(), app=UUID.randomUUID().toString(), event=UUID.randomUUID().toString();
        execute("INSERT INTO auth.users(id,email,full_name,password_hash,role,status) VALUES ('"+candidate+"','v9candidate@example.test','Candidate','hash','CANDIDATE','ACTIVE'),('"+staff+"','v9staff@example.test','HR','hash','RECRUITER','ACTIVE')");
        execute("INSERT INTO candidate.candidate_profiles(user_id) VALUES ('"+candidate+"')");
        execute("INSERT INTO candidate.resumes(id,candidate_id,title,template,status,full_name,email,desired_position,created_at,updated_at) VALUES ('"+resume+"','"+candidate+"','Existing CV','classic','READY','Candidate','v9candidate@example.test','Developer',now(),now())");
        execute("INSERT INTO recruitment.departments(id,name) VALUES ('"+dept+"','V9 department')");
        execute("INSERT INTO recruitment.jobs(id,department_id,created_by,title,description,requirements,benefits,location,employment_type,work_mode,experience_level) VALUES ('"+job+"','"+dept+"','"+staff+"','V9 job','Keep','Keep','','Đà Nẵng','FULL_TIME','HYBRID','JUNIOR')");
        execute("INSERT INTO recruitment.applications(id,job_id,candidate_id,resume_id,status,job_version,job_snapshot,applied_at,updated_at) VALUES ('"+app+"','"+job+"','"+candidate+"','"+resume+"','SUBMITTED',0,'{\"title\":\"Saved JD\"}',now(),now())");
        execute("INSERT INTO recruitment.application_resume_snapshots(application_id,source_resume_version,content,captured_at) VALUES ('"+app+"',0,'{\"title\":\"Saved CV\"}',now())");
        execute("INSERT INTO recruitment.application_status_history(id,application_id,to_status,changed_by,created_at) VALUES ('"+event+"','"+app+"','SUBMITTED','"+candidate+"',now())");
        var tables=java.util.List.of("auth.users","candidate.candidate_profiles","candidate.resumes","recruitment.jobs","recruitment.applications","recruitment.application_resume_snapshots");
        var before=new java.util.HashMap<String,String>();
        for(String table:tables) before.put(table,scalar("SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text FROM "+table+" t"));
        String historyBefore=scalar("SELECT jsonb_agg(to_jsonb(t))::text FROM recruitment.application_status_history t");
        Flyway latest=Flyway.configure().dataSource(databaseUrl,username,password).defaultSchema("public").locations("classpath:db/migration").target("13").load();
        assertEquals(4,latest.migrate().migrationsExecuted);assertEquals(0,latest.migrate().migrationsExecuted);
        for(String table:tables) assertEquals(before.get(table),scalar("SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text FROM "+table+" t"));
        assertEquals(historyBefore,scalar("SELECT jsonb_agg(to_jsonb(t)-'actor_name')::text FROM recruitment.application_status_history t"));
        assertEquals("0",scalar("SELECT count(*)::text FROM recruitment.application_notes"));
        assertEquals("recruitment.application_notes",scalar("SELECT to_regclass('recruitment.application_notes')::text"));
    }

    @Test
    void createsNewDatabaseAndValidatesRepositoryMappings() throws SQLException {
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals("auth.users", scalar("SELECT to_regclass('auth.users')::text"));
        assertEquals("candidate.candidate_profiles", scalar("SELECT to_regclass('candidate.candidate_profiles')::text"));
        assertEquals("public.flyway_schema_history", scalar("SELECT to_regclass('public.flyway_schema_history')::text"));
        assertEquals("text", scalar("SELECT data_type FROM information_schema.columns WHERE table_schema='candidate' AND table_name='candidate_profiles' AND column_name='skills'"));
        assertEquals("YES", scalar("SELECT is_nullable FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='created_at'"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        verifyRepositories();
    }

    @Test
    void movesLegacyTablesWithoutChangingRowsOrDatabaseObjects() throws SQLException {
        loadLegacySchema();
        String candidateId = UUID.randomUUID().toString();
        String recruiterId = UUID.randomUUID().toString();
        String passwordHash = new BCryptPasswordEncoder().encode("MigrationTest123");
        try (var insert = connection.prepareStatement("INSERT INTO public.users VALUES (?::uuid, '2026-09-01T01:02:03Z', ?, ?, ?, ?, 'ACTIVE')")) {
            insert.setString(1, candidateId);
            insert.setString(2, "candidate@example.test");
            insert.setString(3, "Ứng viên thử nghiệm");
            insert.setString(4, passwordHash);
            insert.setString(5, "CANDIDATE");
            insert.executeUpdate();
            insert.setString(1, recruiterId);
            insert.setString(2, "recruiter@example.test");
            insert.setString(3, "Nhà tuyển dụng thử nghiệm");
            insert.setString(5, "RECRUITER");
            insert.executeUpdate();
        }
        execute("INSERT INTO public.candidate_profiles VALUES ('" + candidateId + "', 2.5, 'Developer', NULL, 'Java,React', '2026-09-02T03:04:05Z')");
        String usersBefore = snapshot("public.users", "id");
        String profilesBefore = snapshot("public.candidate_profiles", "user_id");
        String usersOid = scalar("SELECT 'public.users'::regclass::oid::text");
        String profilesOid = scalar("SELECT 'public.candidate_profiles'::regclass::oid::text");
        String indexesBefore = scalar("SELECT array_agg(indexrelid ORDER BY indexrelid)::text FROM pg_index WHERE indrelid IN (" + usersOid + "," + profilesOid + ")");
        String constraintsBefore = scalar("SELECT array_agg(oid ORDER BY oid)::text FROM pg_constraint WHERE conrelid IN (" + usersOid + "," + profilesOid + ")");

        flyway.baseline();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(usersOid, scalar("SELECT 'auth.users'::regclass::oid::text"));
        assertEquals(profilesOid, scalar("SELECT 'candidate.candidate_profiles'::regclass::oid::text"));
        assertEquals(indexesBefore, scalar("SELECT array_agg(indexrelid ORDER BY indexrelid)::text FROM pg_index WHERE indrelid IN (" + usersOid + "," + profilesOid + ")"));
        assertEquals(constraintsBefore, scalar("SELECT array_agg(oid ORDER BY oid)::text FROM pg_constraint WHERE conrelid IN (" + usersOid + "," + profilesOid + ")"));
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals(profilesBefore, snapshot("candidate.candidate_profiles", "user_id"));
        assertNull(scalar("SELECT to_regclass('public.users')::text"));
        assertNull(scalar("SELECT to_regclass('public.candidate_profiles')::text"));
        assertEquals("auth.users", scalar("SELECT confrelid::regclass::text FROM pg_constraint WHERE conrelid='candidate.candidate_profiles'::regclass AND contype='f'"));
        assertEquals("0", scalar("SELECT version FROM public.flyway_schema_history WHERE type='BASELINE'"));
        assertEquals(0, flyway.migrate().migrationsExecuted);
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals(profilesBefore, snapshot("candidate.candidate_profiles", "user_id"));
        Flyway onboarding = Flyway.configure().configuration(flyway.getConfiguration()).target("2").load();
        assertEquals(1, onboarding.migrate().migrationsExecuted);
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals(profilesBefore, scalar("SELECT jsonb_agg(to_jsonb(account) - 'location' - 'desired_position' - 'onboarding_status' - 'onboarding_step' ORDER BY user_id)::text FROM candidate.candidate_profiles account"));
        assertEquals("NOT_STARTED", scalar("SELECT onboarding_status FROM candidate.candidate_profiles WHERE user_id='" + candidateId + "'"));
        assertEquals("0", scalar("SELECT onboarding_step::text FROM candidate.candidate_profiles WHERE user_id='" + candidateId + "'"));
        assertEquals(0, onboarding.migrate().migrationsExecuted);
        verifyRepositories();
    }

    @Test
    void requiresExplicitBaselineForLegacyDatabase() throws SQLException {
        loadLegacySchema();
        assertThrows(FlywayException.class, () -> flyway.migrate());
        assertEquals("public.users", scalar("SELECT to_regclass('public.users')::text"));
        assertNull(scalar("SELECT to_regclass('auth.users')::text"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"auth.users", "candidate.candidate_profiles"})
    void rejectsSourceAndDestinationConflictsWithoutMovingEitherTable(String target) throws SQLException {
        loadLegacySchema();
        String schema = target.substring(0, target.indexOf('.'));
        execute("CREATE SCHEMA " + schema);
        execute("CREATE TABLE " + target + " (marker TEXT)");
        execute("INSERT INTO " + target + " VALUES ('keep this row')");
        flyway.baseline();
        FlywayException error = assertThrows(FlywayException.class, () -> flyway.migrate());
        assertTrue(error.getMessage().contains("resolve the conflict"));
        assertEquals("public.users", scalar("SELECT to_regclass('public.users')::text"));
        assertEquals("public.candidate_profiles", scalar("SELECT to_regclass('public.candidate_profiles')::text"));
        assertEquals("keep this row", scalar("SELECT marker FROM " + target));
        assertEquals("0", scalar("SELECT count(*)::text FROM public.flyway_schema_history WHERE version='1'"));
    }

    @Test
    void preferencesMigrationPreservesLegacyAnswersAndTerminalStates() throws SQLException {
        Flyway.configure().configuration(flyway.getConfiguration()).target("3").load().migrate();
        for (String state : java.util.List.of("IN_PROGRESS", "COMPLETED", "SKIPPED")) {
            String id = UUID.randomUUID().toString();
            execute("INSERT INTO auth.users (id,email,password_hash,full_name,role,status) VALUES ('" + id + "','" + state + "@example.test','preserved-hash','Legacy','CANDIDATE','ACTIVE')");
            execute("INSERT INTO candidate.candidate_profiles (user_id,skills,experience_years,onboarding_status,onboarding_step) VALUES ('" + id + "','Java,SQL'," + (state.equals("IN_PROGRESS") ? "0" : "2.5") + ",'" + state + "',2)");
        }
        String usersBefore = snapshot("auth.users", "id");
        String valuesBefore = scalar("SELECT jsonb_agg(jsonb_build_array(user_id,skills,experience_years,onboarding_status) ORDER BY user_id)::text FROM candidate.candidate_profiles");
        Flyway updated = Flyway.configure().configuration(flyway.getConfiguration()).target("4").load();
        assertEquals(1, updated.migrate().migrationsExecuted);
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals(valuesBefore, scalar("SELECT jsonb_agg(jsonb_build_array(user_id,skills,experience_years,onboarding_status) ORDER BY user_id)::text FROM candidate.candidate_profiles"));
        assertNull(scalar("SELECT experience_range FROM candidate.candidate_profiles WHERE onboarding_status='IN_PROGRESS'"));
        assertEquals("0", scalar("SELECT onboarding_step::text FROM candidate.candidate_profiles WHERE onboarding_status='IN_PROGRESS'"));
        assertEquals("2", scalar("SELECT count(*)::text FROM candidate.candidate_profiles WHERE onboarding_status IN ('COMPLETED','SKIPPED') AND onboarding_step=2 AND experience_range='ONE_TO_THREE'"));
        String after = snapshot("candidate.candidate_profiles", "user_id");
        assertEquals(0, updated.migrate().migrationsExecuted);
        assertEquals(after, snapshot("candidate.candidate_profiles", "user_id"));
    }


    @Test
    void cvMigrationPreservesAccountsAndEnforcesOwnerAndDefaultConstraints() throws SQLException {
        Flyway.configure().configuration(flyway.getConfiguration()).target("4").load().migrate();
        String candidate = UUID.randomUUID().toString();
        execute("INSERT INTO auth.users (id,email,password_hash,full_name,role,status) VALUES ('" + candidate + "','cv-migration@example.test','preserved-hash','Candidate','CANDIDATE','ACTIVE')");
        execute("INSERT INTO candidate.candidate_profiles (user_id,skills) VALUES ('" + candidate + "','Java,SQL')");
        String usersBefore = snapshot("auth.users", "id"); String profilesBefore = snapshot("candidate.candidate_profiles", "user_id");
        Flyway updated = Flyway.configure().configuration(flyway.getConfiguration()).target("5").load();
        assertEquals(1, updated.migrate().migrationsExecuted);
        assertEquals(usersBefore, snapshot("auth.users", "id")); assertEquals(profilesBefore, snapshot("candidate.candidate_profiles", "user_id"));
        assertEquals("candidate.resumes", scalar("SELECT to_regclass('candidate.resumes')::text"));
        String first = UUID.randomUUID().toString(); String second = UUID.randomUUID().toString();
        String insert = "INSERT INTO candidate.resumes(id,candidate_id,title,full_name,email,desired_position,template,status,is_default,created_at,updated_at) VALUES ";
        execute(insert + "('" + first + "','" + candidate + "','One','Name','cv@example.test','Java','classic','READY',true,now(),now())");
        assertThrows(SQLException.class, () -> execute(insert + "('" + second + "','" + candidate + "','Two','Name','cv@example.test','Java','classic','READY',true,now(),now())"));
        execute(insert + "('" + second + "','" + candidate + "','Two','Name','cv@example.test','Java','modern','READY',false,now(),now())");
        assertThrows(SQLException.class, () -> execute("UPDATE candidate.resumes SET skills='{}' WHERE id='" + first + "'"));
        assertThrows(SQLException.class, () -> execute("UPDATE candidate.resumes SET candidate_id='" + UUID.randomUUID() + "' WHERE id='" + first + "'"));
        assertThrows(SQLException.class, () -> execute("UPDATE candidate.resumes SET status='DRAFT' WHERE id='" + first + "'"));
        String before = snapshot("candidate.resumes", "id");
        assertEquals(0, updated.migrate().migrationsExecuted); assertEquals(before, snapshot("candidate.resumes", "id"));
    }

    @Test
    void optionalCvSectionsMigrationPreservesSavedCvAndAddsEmptyArrays() throws SQLException {
        Flyway.configure().configuration(flyway.getConfiguration()).target("5").load().migrate();
        String candidate = UUID.randomUUID().toString(); String resume = UUID.randomUUID().toString();
        execute("INSERT INTO auth.users (id,email,password_hash,full_name,role,status) VALUES ('" + candidate + "','optional-cv@example.test','preserved-hash','Candidate','CANDIDATE','ACTIVE')");
        execute("INSERT INTO candidate.candidate_profiles (user_id,skills) VALUES ('" + candidate + "','Java,SQL')");
        execute("INSERT INTO candidate.resumes(id,candidate_id,title,skills,experiences,template,status,version,created_at,updated_at) VALUES ('" + resume + "','" + candidate + "','Existing CV','[\"Java\"]','[{\"company\":\"Lumi\",\"description\":\"Build API\"}]','classic','DRAFT',7,now(),now())");
        String usersBefore = snapshot("auth.users", "id"); String profilesBefore = snapshot("candidate.candidate_profiles", "user_id");
        String cvBefore = scalar("SELECT to_jsonb(r)::text FROM candidate.resumes r WHERE id='" + resume + "'");
        Flyway updated = Flyway.configure().configuration(flyway.getConfiguration()).target("6").load();
        assertEquals(1, updated.migrate().migrationsExecuted);
        assertEquals(usersBefore, snapshot("auth.users", "id")); assertEquals(profilesBefore, snapshot("candidate.candidate_profiles", "user_id"));
        assertEquals(cvBefore, scalar("SELECT (to_jsonb(r)-'languages'-'awards'-'activities')::text FROM candidate.resumes r WHERE id='" + resume + "'"));
        for (String section : java.util.List.of("languages", "awards", "activities")) {
            assertEquals("[]", scalar("SELECT " + section + "::text FROM candidate.resumes WHERE id='" + resume + "'"));
            assertThrows(SQLException.class, () -> execute("UPDATE candidate.resumes SET " + section + "='{}' WHERE id='" + resume + "'"));
            assertThrows(SQLException.class, () -> execute("UPDATE candidate.resumes SET " + section + "=NULL WHERE id='" + resume + "'"));
        }
        String after = snapshot("candidate.resumes", "id");
        assertEquals(0, updated.migrate().migrationsExecuted); assertEquals(after, snapshot("candidate.resumes", "id"));
        verifyRepositories();
    }

    @Test
    void recruitmentCatalogMigrationPreservesLegacyDataAndBackfillsRelations() throws SQLException {
        migrateTo("6");
        String staff = insertAccount("RECRUITER"), admin = insertAccount("COMPANY_ADMIN");
        String candidate = insertAccount("CANDIDATE");
        execute("INSERT INTO candidate.candidate_profiles(user_id,skills) VALUES ('" + candidate + "','Docker,SQL')");
        execute("INSERT INTO candidate.resumes(id,candidate_id,title,skills,template,status,created_at,updated_at) VALUES ('" + UUID.randomUUID() + "','" + candidate + "','Legacy CV','[\"Docker\"]','classic','DRAFT',now(),now())");
        String department = insertDepartment();
        String job = insertJob(staff, department, " React,react, Spring   Boot, ,SQL, SQL ");
        insertJob(staff, department, "spring boot,React");
        insertJob(staff, department, "");
        String usersBefore = snapshot("auth.users", "id");
        String profilesBefore = snapshot("candidate.candidate_profiles", "user_id");
        String resumesBefore = snapshot("candidate.resumes", "id");
        String jobsBefore = snapshot("recruitment.jobs", "id");
        String departmentsBefore = snapshot("recruitment.departments", "id");
        assertEquals(1, migrateTo("7"));
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals(profilesBefore, snapshot("candidate.candidate_profiles", "user_id"));
        assertEquals(resumesBefore, snapshot("candidate.resumes", "id"));
        assertEquals(departmentsBefore, snapshot("recruitment.departments", "id"));
        assertEquals(jobsBefore, scalar("SELECT jsonb_agg(to_jsonb(j)-'version'-'updated_by' ORDER BY id)::text FROM recruitment.jobs j"));
        assertEquals("3", scalar("SELECT count(*)::text FROM catalog.skills"));
        assertEquals("5", scalar("SELECT count(*)::text FROM recruitment.job_skills"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_skills WHERE is_required"));
        assertEquals("3", scalar("SELECT count(*)::text FROM recruitment.job_skills WHERE job_id='" + job + "'"));
        assertEquals("1", scalar("SELECT count(*)::text FROM catalog.skills WHERE normalized_name='spring boot'"));
        assertEquals("2", scalar("SELECT count(*)::text FROM recruitment.recruiter_profiles WHERE user_id IN ('" + staff + "','" + admin + "')"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.recruiter_profiles WHERE user_id='" + candidate + "'"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_requirements"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_history"));
        String links = snapshot("recruitment.job_skills", "job_id,skill_id");
        assertEquals(0, migrateTo("7"));
        assertEquals(links, snapshot("recruitment.job_skills", "job_id,skill_id"));
    }

    @Test
    void recruitmentCatalogEnforcesUniqueSkillsAndStaffProfiles() throws SQLException {
        migrateTo("7");
        String staff = insertAccount("RECRUITER"), admin = insertAccount("COMPANY_ADMIN");
        String candidate = insertAccount("CANDIDATE");
        execute("INSERT INTO catalog.skills(name) VALUES ('  Spring\tBoot  ')");
        assertEquals("spring boot", scalar("SELECT normalized_name FROM catalog.skills"));
        assertSqlState("23505", "INSERT INTO catalog.skills(name) VALUES ('SPRING   BOOT')");
        assertSqlState("23514", "INSERT INTO catalog.skills(name) VALUES ('   ')");
        assertSqlState("23503", "INSERT INTO recruitment.recruiter_profiles(user_id) VALUES ('" + UUID.randomUUID() + "')");
        assertSqlState("23514", "INSERT INTO recruitment.recruiter_profiles(user_id) VALUES ('" + candidate + "')");
        execute("INSERT INTO recruitment.recruiter_profiles(user_id,employee_code) VALUES ('" + staff + "','HR001')");
        assertSqlState("23505", "INSERT INTO recruitment.recruiter_profiles(user_id,employee_code) VALUES ('" + admin + "','hr001')");
        execute("INSERT INTO recruitment.recruiter_profiles(user_id) VALUES ('" + admin + "')");
        assertSqlState("23505", "INSERT INTO recruitment.recruiter_profiles(user_id) VALUES ('" + staff + "')");
        assertSqlState("23514", "UPDATE auth.users SET role='CANDIDATE' WHERE id='" + staff + "'");
        execute("UPDATE auth.users SET status='INACTIVE' WHERE id='" + staff + "'");
        assertEquals("1", scalar("SELECT count(*)::text FROM recruitment.recruiter_profiles WHERE user_id='" + staff + "'"));
    }

    @Test
    void recruitmentRequirementsHistoryAndForeignKeysAreConstrained() throws SQLException {
        migrateTo("7");
        String staff = insertAccount("RECRUITER"), department = insertDepartment();
        String job = insertJob(staff, department, "");
        String skill = UUID.randomUUID().toString();
        execute("INSERT INTO catalog.skills(id,name) VALUES ('" + skill + "','Java')");
        String link = "INSERT INTO recruitment.job_skills(job_id,skill_id) VALUES ('" + job + "','" + skill + "')";
        execute(link); assertSqlState("23505", link);
        assertSqlState("23503", "DELETE FROM catalog.skills WHERE id='" + skill + "'");
        String requirement = "INSERT INTO recruitment.job_requirements(job_id,type,description,weight) VALUES ('" + job + "',%s,%s,%s)";
        execute(requirement.formatted("'EXPERIENCE'", "'2 years of backend work'", "2"));
        assertSqlState("23514", requirement.formatted("'INVALID'", "'Requirement'", "1"));
        assertSqlState("23514", requirement.formatted("'OTHER'", "'  '", "1"));
        assertSqlState("23514", requirement.formatted("'OTHER'", "'Requirement'", "-1"));
        assertSqlState("23514", requirement.formatted("'OTHER'", "'Requirement'", "101"));
        String history = "INSERT INTO recruitment.job_history(job_id,changed_by,action,from_status,to_status,changes) VALUES ('" + job + "','" + staff + "',%s,%s,%s,%s)";
        assertSqlState("23514", history.formatted("'PUBLISHED'", "NULL", "'PUBLISHED'", "'{}'"));
        assertSqlState("23514", history.formatted("'CREATED'", "NULL", "'DRAFT'", "'[]'"));
        execute(history.formatted("'PUBLISHED'", "'DRAFT'", "'PUBLISHED'", "'{\"status\":{\"before\":\"DRAFT\",\"after\":\"PUBLISHED\"}}'"));
        assertSqlState("55000", "UPDATE recruitment.job_history SET note='rewritten'");
        assertSqlState("55000", "DELETE FROM recruitment.job_history");
        assertSqlState("23503", "DELETE FROM recruitment.jobs WHERE id='" + job + "'");
        String deletable = insertJob(staff, department, "");
        execute("INSERT INTO recruitment.job_skills VALUES ('" + deletable + "','" + skill + "',false)");
        execute("INSERT INTO recruitment.job_requirements(job_id,type,description) VALUES ('" + deletable + "','OTHER','Useful experience')");
        execute("DELETE FROM recruitment.jobs WHERE id='" + deletable + "'");
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_skills WHERE job_id='" + deletable + "'"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_requirements WHERE job_id='" + deletable + "'"));
    }

    @Test
    void recruitmentRepositoriesPersistRelationsAndRejectStaleJobUpdates() throws SQLException {
        migrateTo("7");
        String staff = insertAccount("RECRUITER"), department = insertDepartment();
        String jobId = insertJob(staff, department, "");
        try (var context = new SpringApplicationBuilder(RecruitmentBackendApplication.class)
                .web(WebApplicationType.NONE)
                .run("--spring.datasource.url=" + databaseUrl, "--spring.datasource.username=" + username,
                        "--spring.datasource.password=" + password, "--spring.jpa.show-sql=false",
                        "--logging.level.org.hibernate.SQL=OFF")) {
            var transactions = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
            String fixtureSkill="Migration Fixture "+UUID.randomUUID();
            UUID skillId = transactions.execute(status -> {
                var users = context.getBean(UserRepository.class);
                var profile = new com.lumi.recruitment.entity.recruitment.RecruiterProfile();
                profile.setUser(users.findById(UUID.fromString(staff)).orElseThrow());
                profile.setDepartment(context.getBean(com.lumi.recruitment.repository.DepartmentRepository.class).findById(UUID.fromString(department)).orElseThrow());
                profile = context.getBean(com.lumi.recruitment.repository.RecruiterProfileRepository.class).saveAndFlush(profile);
                assertEquals(UUID.fromString(staff), profile.getUserId());
                var skill = new com.lumi.recruitment.entity.catalog.Skill(); skill.setName(" "+fixtureSkill.replace(" ","   ")+" ");
                skill = context.getBean(com.lumi.recruitment.repository.SkillRepository.class).saveAndFlush(skill);
                assertEquals(fixtureSkill.toLowerCase(java.util.Locale.ROOT), skill.getNormalizedName());
                var job = context.getBean(com.lumi.recruitment.repository.JobRepository.class).findById(UUID.fromString(jobId)).orElseThrow();
                var link = new com.lumi.recruitment.entity.recruitment.JobSkill(); link.setJob(job); link.setSkill(skill);
                context.getBean(com.lumi.recruitment.repository.JobSkillRepository.class).saveAndFlush(link);
                var requirement = new com.lumi.recruitment.entity.recruitment.JobRequirement();
                requirement.setJob(job); requirement.setType(com.lumi.recruitment.entity.recruitment.RequirementType.EXPERIENCE);
                requirement.setDescription("Two years developing APIs");
                context.getBean(com.lumi.recruitment.repository.JobRequirementRepository.class).saveAndFlush(requirement);
                var history = new com.lumi.recruitment.entity.recruitment.JobHistory();
                history.setJob(job); history.setChangedBy(profile.getUser());
                history.setAction(com.lumi.recruitment.entity.recruitment.JobHistoryAction.CREATED); history.setToStatus("DRAFT");
                history.setChanges(java.util.Map.of("title", java.util.Map.of("after", job.getTitle())));
                context.getBean(com.lumi.recruitment.repository.JobHistoryRepository.class).saveAndFlush(history);
                return skill.getId();
            });
            assertEquals(fixtureSkill.toLowerCase(java.util.Locale.ROOT), context.getBean(com.lumi.recruitment.repository.SkillRepository.class).findById(skillId).orElseThrow().getNormalizedName());
            assertEquals(1, context.getBean(com.lumi.recruitment.repository.JobSkillRepository.class).findForJobs(java.util.List.of(UUID.fromString(jobId))).size());
            assertEquals(1, context.getBean(com.lumi.recruitment.repository.JobRequirementRepository.class).findByJobIdOrderBySortOrderAscIdAsc(UUID.fromString(jobId)).size());
            assertEquals(1, context.getBean(com.lumi.recruitment.repository.JobHistoryRepository.class).findByJobIdOrderByCreatedAtDescIdAsc(UUID.fromString(jobId), org.springframework.data.domain.PageRequest.of(0,10)).getTotalElements());
            var jobs = context.getBean(com.lumi.recruitment.repository.JobRepository.class);
            var first = jobs.findById(UUID.fromString(jobId)).orElseThrow();
            var stale = jobs.findById(UUID.fromString(jobId)).orElseThrow();
            first.setTitle("Edited once");
            assertEquals(1, jobs.saveAndFlush(first).getVersion());
            stale.setTitle("Stale edit");
            assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class, () -> jobs.saveAndFlush(stale));
        }
    }

    @Test
    void jobHeadcountMigrationPreservesJobsAndEnforcesPositiveIntegers() throws SQLException {
        migrateTo("7");
        String staff = insertAccount("RECRUITER"), department = insertDepartment();
        String jobId = insertJob(staff, department, "Java");
        String jobsBefore = snapshot("recruitment.jobs", "id");
        String usersBefore = snapshot("auth.users", "id");
        assertEquals(1, migrateTo("8"));
        assertEquals(jobsBefore, scalar("SELECT jsonb_agg(to_jsonb(j)-'headcount' ORDER BY id)::text FROM recruitment.jobs j"));
        assertEquals(usersBefore, snapshot("auth.users", "id"));
        assertEquals("1", scalar("SELECT headcount::text FROM recruitment.jobs WHERE id='" + jobId + "'"));
        assertEquals("integer", scalar("SELECT data_type FROM information_schema.columns WHERE table_schema='recruitment' AND table_name='jobs' AND column_name='headcount'"));
        assertEquals("NO", scalar("SELECT is_nullable FROM information_schema.columns WHERE table_schema='recruitment' AND table_name='jobs' AND column_name='headcount'"));
        String update = "UPDATE recruitment.jobs SET headcount=%s WHERE id='" + jobId + "'";
        assertSqlState("23514", update.formatted("0"));
        assertSqlState("23514", update.formatted("-1"));
        assertSqlState("23502", update.formatted("NULL"));
        assertSqlState("22003", update.formatted("2147483648"));
        execute(update.formatted("7"));
        assertEquals("7", scalar("SELECT headcount::text FROM recruitment.jobs WHERE id='" + jobId + "'"));
        String second = insertJob(staff, department, "");
        assertEquals("1", scalar("SELECT headcount::text FROM recruitment.jobs WHERE id='" + second + "'"));
        String after = snapshot("recruitment.jobs", "id");
        assertEquals(0, migrateTo("8"));
        assertEquals(after, snapshot("recruitment.jobs", "id"));
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var job = new com.lumi.recruitment.entity.recruitment.Job();
            assertEquals(1, job.getHeadcount());
            for (Integer value : java.util.Arrays.asList(null, 0, -1)) {
                job.setHeadcount(value);
                assertFalse(validator.validateProperty(job, "headcount").isEmpty());
            }
            job.setHeadcount(7);
            assertTrue(validator.validateProperty(job, "headcount").isEmpty());
        }
    }

    @Test
    void positionsMigrationPreservesLegacyTitleAndEnforcesDepartmentForeignKey() throws Exception {
        assertEquals(13, migrateTo("13"));
        String user = insertAccount("RECRUITER");
        String dept = insertDepartment();
        execute("UPDATE recruitment.departments SET name='IT' WHERE id='" + dept + "'");
        String other = insertDepartment();
        String job = insertJob(user, dept, "Java");
        String before = scalar("SELECT (to_jsonb(j))::text FROM recruitment.jobs j WHERE id='" + job + "'");
        assertEquals(1, migrateTo("14"));
        assertEquals(0, migrateTo("14"));
        assertEquals(before, scalar("SELECT (to_jsonb(j)-'position_id')::text FROM recruitment.jobs j WHERE id='" + job + "'"));
        assertEquals("7", scalar("SELECT count(*)::text FROM recruitment.job_positions WHERE department_id='" + dept + "'"));
        assertEquals("0", scalar("SELECT count(*)::text FROM recruitment.job_positions WHERE department_id='" + other + "'"));
        String position = scalar("SELECT id::text FROM recruitment.job_positions WHERE department_id='" + dept + "' AND name='Backend Developer'");
        execute("UPDATE recruitment.jobs SET position_id='" + position + "' WHERE id='" + job + "'");
        assertThrows(SQLException.class, () -> execute("UPDATE recruitment.jobs SET department_id='" + other + "' WHERE id='" + job + "'"));
        assertThrows(SQLException.class, () -> execute("INSERT INTO recruitment.job_positions(department_id,name) VALUES ('" + dept + "','backend developer')"));
    }

    private int migrateTo(String target) {
        return Flyway.configure().configuration(flyway.getConfiguration()).target(target).load().migrate().migrationsExecuted;
    }

    private String insertAccount(String role) throws SQLException {
        String id = UUID.randomUUID().toString();
        execute("INSERT INTO auth.users(id,email,password_hash,full_name,role,status) VALUES ('" + id + "','" + id + "@example.test','preserved-hash','Fixture','" + role + "','ACTIVE')");
        return id;
    }

    private String insertDepartment() throws SQLException {
        String id = UUID.randomUUID().toString();
        execute("INSERT INTO recruitment.departments(id,name) VALUES ('" + id + "','Department " + id + "')");
        return id;
    }

    private String insertJob(String user, String department, String skills) throws SQLException {
        String id = UUID.randomUUID().toString();
        execute("INSERT INTO recruitment.jobs(id,created_by,department_id,title,description,requirements,benefits,skills,location,employment_type,work_mode,experience_level,status) VALUES ('" + id + "','" + user + "','" + department + "','Backend','Build APIs','Java and SQL','Learning budget','" + skills + "','Da Nang','FULL_TIME','HYBRID','JUNIOR','DRAFT')");
        return id;
    }

    private void assertSqlState(String state, String sql) {
        assertEquals(state, assertThrows(SQLException.class, () -> execute(sql)).getSQLState());
    }

    private void verifyRepositories() {
        try (var context = new SpringApplicationBuilder(RecruitmentBackendApplication.class)
                .web(WebApplicationType.NONE)
                .run("--spring.datasource.url=" + databaseUrl,
                        "--spring.datasource.username=" + username,
                        "--spring.datasource.password=" + password,
                        "--spring.jpa.hibernate.ddl-auto=validate",
                        "--spring.jpa.show-sql=false",
                        "--logging.level.org.hibernate.SQL=OFF")) {
            var users = context.getBean(UserRepository.class);
            var profiles = context.getBean(CandidateProfileRepository.class);
            var transactions = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
            UUID userId = transactions.execute(status -> {
                User user = users.saveAndFlush(User.builder()
                        .email("repository@example.test")
                        .passwordHash("test-only-hash")
                        .fullName("Repository Test")
                        .role(UserRole.CANDIDATE)
                        .build());
                CandidateProfile profile = profiles.saveAndFlush(CandidateProfile.builder()
                        .user(user)
                        .skills("Java,React")
                        .build());
                assertEquals(user.getId(), profile.getUserId());
                return user.getId();
            });
            transactions.executeWithoutResult(status -> {
                User user = users.findById(userId).orElseThrow();
                CandidateProfile profile = profiles.findById(userId).orElseThrow();
                assertEquals(userId, user.getCandidateProfile().getUserId());
                assertEquals(userId, profile.getUser().getId());
                profile.setHeadline("Updated through repository");
                profiles.saveAndFlush(profile);
            });
            assertEquals("Updated through repository", profiles.findById(userId).orElseThrow().getHeadline());
        }
    }

    private void loadLegacySchema() throws SQLException {
        ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/legacy_accounts.sql"));
    }

    private void execute(String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private String scalar(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }

    private String snapshot(String table, String key) throws SQLException {
        return scalar("SELECT jsonb_agg(to_jsonb(account) ORDER BY " + key + ")::text FROM " + table + " account");
    }
}
