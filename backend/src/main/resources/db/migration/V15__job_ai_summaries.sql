-- One reusable summary for the current public JD. Fingerprints include structured
-- skills and requirements, so updates invalidate content without deleting history.
CREATE TABLE recruitment.job_ai_summaries (
    job_id uuid PRIMARY KEY REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
    source_hash varchar(64) NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
    prompt_version varchar(40) NOT NULL,
    model_name varchar(100) NOT NULL,
    items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 16),
    generated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE recruitment.job_ai_summaries IS
    'Cached public JD summaries with verbatim evidence; never contains candidate CVs or assessments.';
