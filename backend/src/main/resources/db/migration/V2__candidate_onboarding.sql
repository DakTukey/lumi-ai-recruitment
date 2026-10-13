ALTER TABLE candidate.candidate_profiles
    ADD COLUMN location varchar(255),
    ADD COLUMN desired_position varchar(255),
    ADD COLUMN onboarding_status varchar(20) NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0,
    ADD CONSTRAINT candidate_onboarding_status_check CHECK (onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    ADD CONSTRAINT candidate_onboarding_step_check CHECK (onboarding_step BETWEEN 0 AND 2);
