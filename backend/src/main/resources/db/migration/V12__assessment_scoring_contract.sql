-- Preserve prior assessments; new evaluations retain the JD's fractional weights and stable keys.
ALTER TABLE recruitment.ai_assessment_criteria
    ALTER COLUMN weight TYPE numeric(5,2) USING weight::numeric(5,2),
    ADD COLUMN criterion_key varchar(100);
CREATE UNIQUE INDEX ai_assessment_criterion_key_idx
    ON recruitment.ai_assessment_criteria(assessment_id, criterion_key);
COMMENT ON COLUMN recruitment.ai_assessment_criteria.points IS
    'Match percentage 0..100, distinct from the criterion weight.';
