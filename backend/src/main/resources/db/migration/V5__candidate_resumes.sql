CREATE TABLE candidate.resumes (
    id uuid PRIMARY KEY,
    candidate_id uuid NOT NULL REFERENCES candidate.candidate_profiles(user_id),
    title varchar(100) NOT NULL CHECK (length(btrim(title)) > 0),
    full_name varchar(150),
    email varchar(255),
    phone varchar(30),
    location varchar(255),
    desired_position varchar(255),
    summary text,
    github_url varchar(2048),
    linkedin_url varchar(2048),
    portfolio_url varchar(2048),
    skills jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(skills) = 'array'),
    experiences jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(experiences) = 'array'),
    educations jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(educations) = 'array'),
    projects jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(projects) = 'array'),
    certifications jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(certifications) = 'array'),
    template varchar(20) NOT NULL CHECK (template IN ('classic', 'modern')),
    status varchar(20) NOT NULL CHECK (status IN ('DRAFT', 'READY')),
    is_default boolean NOT NULL DEFAULT false,
    version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK (NOT is_default OR status = 'READY'),
    CHECK (status <> 'READY' OR (
        length(btrim(coalesce(full_name, ''))) > 0 AND
        length(btrim(coalesce(email, ''))) > 0 AND
        length(btrim(coalesce(desired_position, ''))) > 0))
);
CREATE INDEX resumes_candidate_updated_idx ON candidate.resumes(candidate_id, updated_at DESC);
CREATE UNIQUE INDEX resumes_one_default_per_candidate ON candidate.resumes(candidate_id) WHERE is_default;
