-- Retain immutable machine extraction; candidate corrections are versioned separately.
ALTER TABLE candidate.resume_documents
 ADD COLUMN reviewed_content jsonb CHECK (reviewed_content IS NULL OR jsonb_typeof(reviewed_content)='object'),
 ADD COLUMN review_version bigint NOT NULL DEFAULT 0 CHECK (review_version >= 0),
 ADD COLUMN confirmed_at timestamptz,
 ADD CONSTRAINT confirmed_pdf_has_review CHECK (confirmed_at IS NULL OR (status='PARSED' AND reviewed_content IS NOT NULL));
