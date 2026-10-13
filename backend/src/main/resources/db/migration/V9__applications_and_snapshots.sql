ALTER TABLE candidate.resumes ADD CONSTRAINT resumes_id_candidate_unique UNIQUE (id, candidate_id);
CREATE TABLE recruitment.applications (
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES recruitment.jobs(id),
 candidate_id uuid NOT NULL REFERENCES candidate.candidate_profiles(user_id),
 resume_id uuid NOT NULL,
 status varchar(20) NOT NULL CHECK (status IN ('SUBMITTED','REVIEWING','INTERVIEW','OFFER','HIRED','REJECTED','WITHDRAWN')),
 cover_letter text CHECK (length(cover_letter) <= 10000),
 job_version bigint NOT NULL CHECK (job_version >= 0),
 job_snapshot jsonb NOT NULL CHECK (jsonb_typeof(job_snapshot) = 'object'),
 version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
 applied_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CONSTRAINT application_resume_owner_fk FOREIGN KEY (resume_id,candidate_id) REFERENCES candidate.resumes(id,candidate_id),
 CONSTRAINT application_job_candidate_unique UNIQUE (job_id,candidate_id)
);
CREATE TABLE recruitment.application_resume_snapshots (
 application_id uuid PRIMARY KEY REFERENCES recruitment.applications(id),
 source_resume_version bigint NOT NULL CHECK (source_resume_version >= 0),
 schema_version int NOT NULL DEFAULT 1 CHECK (schema_version > 0),
 content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
 captured_at timestamptz NOT NULL
);
CREATE TABLE recruitment.application_status_history (
 id uuid PRIMARY KEY,
 application_id uuid NOT NULL REFERENCES recruitment.applications(id),
 from_status varchar(20) CHECK (from_status IN ('SUBMITTED','REVIEWING','INTERVIEW','OFFER','HIRED','REJECTED','WITHDRAWN')),
 to_status varchar(20) NOT NULL CHECK (to_status IN ('SUBMITTED','REVIEWING','INTERVIEW','OFFER','HIRED','REJECTED','WITHDRAWN')),
 changed_by uuid NOT NULL REFERENCES auth.users(id),
 reason text,
 created_at timestamptz NOT NULL,
 CHECK (from_status IS DISTINCT FROM to_status)
);
CREATE INDEX applications_job_stage_idx ON recruitment.applications(job_id,status,applied_at DESC,id);
CREATE INDEX applications_candidate_idx ON recruitment.applications(candidate_id,applied_at DESC,id);
CREATE INDEX applications_resume_idx ON recruitment.applications(resume_id);
CREATE INDEX application_history_idx ON recruitment.application_status_history(application_id,created_at,id);
-- Submitted content and audit entries are append-only, also for direct SQL writes.
CREATE FUNCTION recruitment.reject_evidence_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Submitted evidence and history are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER resume_snapshot_immutable BEFORE UPDATE OR DELETE ON recruitment.application_resume_snapshots
 FOR EACH ROW EXECUTE FUNCTION recruitment.reject_evidence_change();
CREATE TRIGGER application_history_immutable BEFORE UPDATE OR DELETE ON recruitment.application_status_history
 FOR EACH ROW EXECUTE FUNCTION recruitment.reject_evidence_change();
CREATE FUNCTION recruitment.protect_application_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(OLD.job_id,OLD.candidate_id,OLD.resume_id,OLD.cover_letter,OLD.job_version,OLD.job_snapshot,OLD.applied_at)
 IS DISTINCT FROM ROW(NEW.job_id,NEW.candidate_id,NEW.resume_id,NEW.cover_letter,NEW.job_version,NEW.job_snapshot,NEW.applied_at)
 THEN RAISE EXCEPTION 'Submitted application content is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER application_submission_immutable BEFORE UPDATE ON recruitment.applications
 FOR EACH ROW EXECUTE FUNCTION recruitment.protect_application_submission();
