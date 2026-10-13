CREATE SCHEMA recruitment;
CREATE TABLE recruitment.departments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(150) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
 description text,
 is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE recruitment.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 department_id uuid NOT NULL REFERENCES recruitment.departments(id),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 title varchar(255) NOT NULL CHECK (length(trim(title)) > 0),
 description text NOT NULL,
 requirements text NOT NULL,
 benefits text NOT NULL,
 skills text NOT NULL DEFAULT '',
 location varchar(255) NOT NULL,
 employment_type varchar(20) NOT NULL CHECK (employment_type IN ('FULL_TIME','PART_TIME','INTERNSHIP','CONTRACT')),
 work_mode varchar(20) NOT NULL CHECK (work_mode IN ('ONSITE','HYBRID','REMOTE')),
 experience_level varchar(20) NOT NULL CHECK (experience_level IN ('INTERN','JUNIOR','MIDDLE','SENIOR')),
 salary_min numeric(15,2), salary_max numeric(15,2),
 currency varchar(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
 status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','CLOSED')),
 featured boolean NOT NULL DEFAULT false,
 published_at timestamptz,
 application_deadline timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (salary_min IS NULL OR salary_min >= 0),
 CHECK (salary_max IS NULL OR salary_max >= 0),
 CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
 CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
 CHECK (application_deadline IS NULL OR published_at IS NULL OR application_deadline > published_at)
);
CREATE INDEX jobs_department_idx ON recruitment.jobs(department_id);
CREATE INDEX jobs_creator_idx ON recruitment.jobs(created_by);
CREATE INDEX jobs_publication_idx ON recruitment.jobs(status, published_at DESC, id);
CREATE INDEX jobs_deadline_idx ON recruitment.jobs(application_deadline);
