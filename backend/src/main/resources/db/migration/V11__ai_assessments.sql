-- AI Assessment tables — lưu kết quả Gemini đánh giá CV vs JD
-- Append-only: không update sau khi tạo (giống job_history)

CREATE TABLE recruitment.ai_assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES recruitment.applications(id),
    model_name varchar(50) NOT NULL,
    prompt_version varchar(20) NOT NULL DEFAULT 'v1',
    score integer NOT NULL,
    summary text NOT NULL,
    matched_skills jsonb NOT NULL DEFAULT '[]',
    missing_skills jsonb NOT NULL DEFAULT '[]',
    gaps jsonb NOT NULL DEFAULT '[]',
    interview_questions jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_assessments_score_range CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT ai_assessments_matched_skills_array CHECK (jsonb_typeof(matched_skills) = 'array'),
    CONSTRAINT ai_assessments_missing_skills_array CHECK (jsonb_typeof(missing_skills) = 'array'),
    CONSTRAINT ai_assessments_gaps_array CHECK (jsonb_typeof(gaps) = 'array'),
    CONSTRAINT ai_assessments_questions_array CHECK (jsonb_typeof(interview_questions) = 'array')
);

-- Mỗi kỹ năng / tiêu chí được đánh giá riêng với bằng chứng
CREATE TABLE recruitment.ai_assessment_criteria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES recruitment.ai_assessments(id) ON DELETE CASCADE,
    skill varchar(255) NOT NULL,
    match_level varchar(20) NOT NULL,
    evidence text,
    reason text,
    points integer NOT NULL DEFAULT 0,
    weight integer NOT NULL DEFAULT 10,
    CONSTRAINT ai_criteria_match_level CHECK (match_level IN ('MATCHED', 'PARTIAL', 'NO_EVIDENCE')),
    CONSTRAINT ai_criteria_points_range CHECK (points BETWEEN 0 AND 100),
    CONSTRAINT ai_criteria_weight_range CHECK (weight BETWEEN 0 AND 100)
);

CREATE INDEX ai_assessments_application_idx ON recruitment.ai_assessments(application_id, created_at DESC);
CREATE INDEX ai_assessment_criteria_assessment_idx ON recruitment.ai_assessment_criteria(assessment_id);

-- Immutable: kết quả AI không được sửa sau khi tạo
CREATE TRIGGER ai_assessments_immutable BEFORE UPDATE OR DELETE ON recruitment.ai_assessments
    FOR EACH ROW EXECUTE FUNCTION recruitment.reject_evidence_change();
CREATE TRIGGER ai_assessment_criteria_immutable BEFORE UPDATE OR DELETE ON recruitment.ai_assessment_criteria
    FOR EACH ROW EXECUTE FUNCTION recruitment.reject_evidence_change();

COMMENT ON TABLE recruitment.ai_assessments IS
    'Kết quả đánh giá AI (Gemini) cho từng đơn ứng tuyển. Append-only — không sửa sau khi tạo.';
COMMENT ON COLUMN recruitment.ai_assessments.gaps IS
    'Mảng JSON: [{skill, currentLevel, targetLevel, roadmap}] — khoảng cách kỹ năng và lộ trình học.';
COMMENT ON COLUMN recruitment.ai_assessments.interview_questions IS
    'Mảng JSON: [{question, reason, targetSkill}] — câu hỏi phỏng vấn gợi ý từ AI.';
