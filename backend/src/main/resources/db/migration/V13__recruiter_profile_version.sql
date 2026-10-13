ALTER TABLE recruitment.recruiter_profiles
    ADD COLUMN version bigint NOT NULL DEFAULT 0 CHECK (version >= 0);
COMMENT ON COLUMN recruitment.recruiter_profiles.version IS
    'Optimistic version for self-service profile updates; prevents stale forms overwriting changes.';
