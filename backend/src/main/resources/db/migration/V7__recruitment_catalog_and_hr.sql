CREATE SCHEMA catalog;

CREATE FUNCTION catalog.normalize_skill_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT lower(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g')))
$$;

CREATE TABLE catalog.skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    normalized_name text GENERATED ALWAYS AS (catalog.normalize_skill_name(name)) STORED NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT skills_name_not_blank CHECK (normalized_name <> ''),
    CONSTRAINT skills_normalized_name_unique UNIQUE (normalized_name)
);

CREATE TABLE recruitment.recruiter_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    employee_code varchar(50),
    phone varchar(30),
    job_title varchar(255),
    department_id uuid REFERENCES recruitment.departments(id),
    avatar_url varchar(2048),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (employee_code IS NULL OR (employee_code = btrim(employee_code) AND employee_code <> '')),
    CHECK (job_title IS NULL OR length(btrim(job_title)) > 0)
);
CREATE UNIQUE INDEX recruiter_employee_code_unique
    ON recruitment.recruiter_profiles (lower(employee_code)) WHERE employee_code IS NOT NULL;
CREATE INDEX recruiter_profiles_department_idx ON recruitment.recruiter_profiles(department_id);

-- Profiles belong to recruitment staff, including an Admin acting as a recruiter.
CREATE FUNCTION recruitment.check_recruiter_profile_role() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE account_role text;
BEGIN
    SELECT role INTO account_role FROM auth.users WHERE id = NEW.user_id FOR SHARE;
    IF account_role IS NULL THEN
        RAISE EXCEPTION 'Recruiter profile requires an existing account' USING ERRCODE = '23503';
    END IF;
    IF account_role NOT IN ('RECRUITER', 'COMPANY_ADMIN') THEN
        RAISE EXCEPTION 'Recruiter profile requires recruitment staff role' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;
CREATE TRIGGER recruiter_profile_role BEFORE INSERT OR UPDATE OF user_id
    ON recruitment.recruiter_profiles FOR EACH ROW
    EXECUTE FUNCTION recruitment.check_recruiter_profile_role();

CREATE FUNCTION recruitment.check_staff_role_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.role NOT IN ('RECRUITER', 'COMPANY_ADMIN')
       AND EXISTS (SELECT 1 FROM recruitment.recruiter_profiles WHERE user_id = NEW.id) THEN
        RAISE EXCEPTION 'Remove recruiter profile before changing to a non-staff role' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;
CREATE TRIGGER account_recruiter_profile_role BEFORE UPDATE OF role ON auth.users
    FOR EACH ROW EXECUTE FUNCTION recruitment.check_staff_role_change();

CREATE TABLE recruitment.job_skills (
    job_id uuid NOT NULL REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
    skill_id uuid NOT NULL REFERENCES catalog.skills(id),
    is_required boolean NOT NULL DEFAULT true,
    PRIMARY KEY (job_id, skill_id)
);
CREATE INDEX job_skills_skill_idx ON recruitment.job_skills(skill_id);

CREATE TABLE recruitment.job_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
    type varchar(20) NOT NULL CHECK (type IN ('EXPERIENCE', 'EDUCATION', 'LANGUAGE', 'OTHER')),
    description text NOT NULL CHECK (length(btrim(description)) > 0),
    is_required boolean NOT NULL DEFAULT true,
    weight numeric(5,2) NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 100),
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0)
);
CREATE INDEX job_requirements_order_idx ON recruitment.job_requirements(job_id, sort_order, id);

ALTER TABLE recruitment.jobs
    ADD COLUMN version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
    ADD COLUMN updated_by uuid REFERENCES auth.users(id);
CREATE INDEX jobs_updated_by_idx ON recruitment.jobs(updated_by);

CREATE TABLE recruitment.job_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES recruitment.jobs(id),
    changed_by uuid NOT NULL REFERENCES auth.users(id),
    action varchar(20) NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'PUBLISHED', 'CLOSED', 'REOPENED')),
    from_status varchar(20) CHECK (from_status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    to_status varchar(20) NOT NULL CHECK (to_status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    note text,
    changes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(changes) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((
        (action = 'CREATED' AND from_status IS NULL)
        OR (action = 'UPDATED' AND from_status = to_status)
        OR (action = 'PUBLISHED' AND from_status = 'DRAFT' AND to_status = 'PUBLISHED')
        OR (action = 'CLOSED' AND from_status IN ('DRAFT', 'PUBLISHED') AND to_status = 'CLOSED')
        OR (action = 'REOPENED' AND from_status = 'CLOSED' AND to_status = 'PUBLISHED')
    ) IS TRUE)
);
CREATE INDEX job_history_timeline_idx ON recruitment.job_history(job_id, created_at DESC, id);
CREATE INDEX job_history_actor_idx ON recruitment.job_history(changed_by);

CREATE FUNCTION recruitment.protect_job_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Job history is append-only' USING ERRCODE = '55000';
END
$$;
CREATE TRIGGER job_history_append_only BEFORE UPDATE OR DELETE ON recruitment.job_history
    FOR EACH ROW EXECUTE FUNCTION recruitment.protect_job_history();

CREATE FUNCTION catalog.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = statement_timestamp();
    RETURN NEW;
END
$$;
CREATE TRIGGER skills_updated_at BEFORE UPDATE ON catalog.skills
    FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();
CREATE TRIGGER recruiter_profile_updated_at BEFORE UPDATE ON recruitment.recruiter_profiles
    FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();

-- Preserve raw legacy skills and all other existing job columns. Do not invent
-- requiredness or parse free-form requirements into AI assessment criteria.
CREATE TEMP TABLE legacy_job_skill_tokens ON COMMIT DROP AS
SELECT j.id AS job_id,
       btrim(regexp_replace(token, '[[:space:]]+', ' ', 'g')) AS name,
       catalog.normalize_skill_name(token) AS normalized_name
FROM recruitment.jobs j CROSS JOIN LATERAL regexp_split_to_table(j.skills, ',') token
WHERE catalog.normalize_skill_name(token) <> '';

INSERT INTO catalog.skills(name)
SELECT min(name COLLATE "C") FROM legacy_job_skill_tokens GROUP BY normalized_name;
INSERT INTO recruitment.job_skills(job_id, skill_id, is_required)
SELECT DISTINCT tokens.job_id, skills.id, false
FROM legacy_job_skill_tokens tokens JOIN catalog.skills skills USING (normalized_name);

INSERT INTO recruitment.recruiter_profiles(user_id)
SELECT id FROM auth.users WHERE role IN ('RECRUITER', 'COMPANY_ADMIN');

COMMENT ON COLUMN recruitment.jobs.skills IS
    'Legacy text retained for migration compatibility. New reads/writes use recruitment.job_skills; no automatic synchronization.';
COMMENT ON COLUMN recruitment.jobs.requirements IS
    'Public free-form requirements text. Structured non-skill assessment criteria live in recruitment.job_requirements.';
COMMENT ON TABLE recruitment.job_history IS
    'Append-only records. The future recruiter write service must insert history in the same transaction as each job change.';
