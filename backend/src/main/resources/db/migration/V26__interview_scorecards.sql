CREATE TABLE recruitment.application_interview_scorecards (
    application_id     uuid PRIMARY KEY REFERENCES recruitment.applications(id),
    interviewer_id     uuid REFERENCES auth.users(id),
    interviewer_name   varchar(200),
    status             varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    overall_score      numeric(3, 1),
    recommendation     varchar(30) CHECK (recommendation IN ('STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE')),
    overall_notes      text,
    sections           jsonb NOT NULL DEFAULT '[]',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE recruitment.application_interview_scorecards IS
    'Phiếu phỏng vấn chuẩn hóa (Interview Scorecard) được AI chuẩn bị câu hỏi và HR chấm điểm trong buổi phỏng vấn.';

