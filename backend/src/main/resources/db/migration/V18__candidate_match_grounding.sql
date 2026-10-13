-- Invalidate legacy results; cache now covers JD children/catalog names as well as versions.
ALTER TABLE recruitment.candidate_job_matches
    ADD COLUMN source_hash varchar(64),
    ADD COLUMN prompt_version varchar(50),
    ADD COLUMN model_name varchar(100);
COMMENT ON COLUMN recruitment.candidate_job_matches.source_hash IS
    'SHA-256 of server CV/JD snapshot including job skills, requirements and catalog names.';
