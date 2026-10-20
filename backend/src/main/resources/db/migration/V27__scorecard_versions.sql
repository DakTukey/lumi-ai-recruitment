ALTER TABLE recruitment.application_interview_scorecards
    ADD COLUMN version bigint NOT NULL DEFAULT 0 CHECK (version >= 0);

COMMENT ON COLUMN recruitment.application_interview_scorecards.version IS
    'Optimistic version for HR saves and AI regeneration. Submitted CV/JD and generated question metadata remain separate from HR ratings.';
