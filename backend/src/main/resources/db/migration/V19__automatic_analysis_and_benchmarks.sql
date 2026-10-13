-- Derived context metadata preserves immutable submitted evidence and historical assessments.
ALTER TABLE recruitment.applications ADD COLUMN ai_job_context_hash varchar(64);
ALTER TABLE recruitment.ai_assessments
    ALTER COLUMN model_name TYPE varchar(100),
    ADD COLUMN job_context_hash varchar(64),
    ADD COLUMN input_hash varchar(64),
    ADD COLUMN evaluation_version varchar(50);
ALTER TABLE recruitment.candidate_job_matches
    ADD COLUMN assessment_payload jsonb CHECK(assessment_payload IS NULL OR jsonb_typeof(assessment_payload)='object'),
    ADD COLUMN job_context_hash varchar(64),
    ADD COLUMN input_hash varchar(64),
    ADD COLUMN evaluation_version varchar(50);
CREATE TABLE recruitment.ai_analysis_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL UNIQUE REFERENCES recruitment.applications(id),
    status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED','SKIPPED')),
    attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    lease_token uuid,
    lease_until timestamptz,
    result_assessment_id uuid REFERENCES recruitment.ai_assessments(id),
    last_error_code varchar(50),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK((status='PROCESSING') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
    CHECK(status <> 'COMPLETED' OR result_assessment_id IS NOT NULL)
);
CREATE INDEX ai_analysis_tasks_due_idx ON recruitment.ai_analysis_tasks(status,next_attempt_at,lease_until);
CREATE INDEX ai_assessments_benchmark_idx ON recruitment.ai_assessments(application_id,created_at DESC,id DESC)
    INCLUDE(job_context_hash,evaluation_version,model_name,score);
COMMENT ON TABLE recruitment.ai_analysis_tasks IS 'Durable analysis queue; new submissions only. No automatic paid backfill of historical CVs.';
