ALTER TABLE recruitment.jobs
    ADD COLUMN headcount integer NOT NULL DEFAULT 1,
    ADD CONSTRAINT jobs_headcount_positive CHECK (headcount > 0);

COMMENT ON COLUMN recruitment.jobs.headcount IS
    'Number of people to recruit for this job; positive integer, defaults to 1. Not an application count.';
