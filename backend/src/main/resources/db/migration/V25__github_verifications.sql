CREATE TABLE recruitment.application_github_verifications (
    application_id     uuid PRIMARY KEY REFERENCES recruitment.applications(id),
    github_username    varchar(200) NOT NULL,
    verified_skills    jsonb NOT NULL DEFAULT '[]',
    unverified_skills  jsonb NOT NULL DEFAULT '[]',
    matched_projects   jsonb NOT NULL DEFAULT '[]',
    code_quality_score integer NOT NULL CHECK (code_quality_score BETWEEN 1 AND 10),
    technical_summary  text NOT NULL CHECK (length(btrim(technical_summary)) BETWEEN 1 AND 1000),
    interview_suggestions jsonb NOT NULL DEFAULT '[]',
    vibe_coding_flags  jsonb NOT NULL DEFAULT '[]',
    has_tests          boolean NOT NULL DEFAULT false,
    has_docker         boolean NOT NULL DEFAULT false,
    has_ci             boolean NOT NULL DEFAULT false,
    top_languages      jsonb NOT NULL DEFAULT '{}',
    model_name         varchar(100),
    fetched_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE recruitment.application_github_verifications IS
    'Kết quả đối chiếu GitHub công khai với CV. Kết quả bổ sung cho HR, không tự thay đổi điểm hay chuyển vòng.';

