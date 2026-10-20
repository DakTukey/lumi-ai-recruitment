CREATE TABLE recruitment.application_clarification_sets (
    application_id uuid PRIMARY KEY REFERENCES recruitment.applications(id),
    assessment_id uuid NOT NULL REFERENCES recruitment.ai_assessments(id),
    state varchar(20) NOT NULL CHECK (state IN ('GENERATING','READY','NOT_NEEDED','FAILED')),
    lease_token uuid,
    lease_until timestamptz,
    retry_at timestamptz NOT NULL DEFAULT now(),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    window_started_at timestamptz NOT NULL DEFAULT now(),
    model_name varchar(100),
    prompt_version varchar(30),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((state = 'GENERATING') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);

CREATE TABLE recruitment.application_clarification_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES recruitment.application_clarification_sets(application_id),
    position integer NOT NULL CHECK (position BETWEEN 0 AND 2),
    criterion_key varchar(100) NOT NULL,
    requirement text NOT NULL,
    evidence text NOT NULL DEFAULT '',
    match_level varchar(20) NOT NULL CHECK (match_level IN ('PARTIAL','NO_EVIDENCE')),
    required boolean NOT NULL,
    question text NOT NULL CHECK (length(btrim(question)) BETWEEN 1 AND 1200),
    response_status varchar(20) NOT NULL DEFAULT 'UNANSWERED' CHECK (response_status IN ('UNANSWERED','ANSWERED','SKIPPED')),
    answer text NOT NULL DEFAULT '' CHECK (length(answer) <= 3000),
    version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
    answered_at timestamptz,
    UNIQUE (application_id, position),
    UNIQUE (application_id, criterion_key),
    CHECK ((response_status = 'ANSWERED' AND length(btrim(answer)) > 0) OR (response_status <> 'ANSWERED' AND answer = '')),
    CHECK ((response_status = 'UNANSWERED') = (answered_at IS NULL))
);

COMMENT ON TABLE recruitment.application_clarification_questions IS
    'Optional candidate self-reported answers. Separate from immutable CV evidence and AI assessment; never used to automatically change scores or stages.';
