CREATE TABLE candidate.resume_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 candidate_id uuid NOT NULL REFERENCES candidate.candidate_profiles(user_id),
 filename varchar(255) NOT NULL,
 sha256 varchar(64) NOT NULL,
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 10485760),
 status varchar(20) NOT NULL DEFAULT 'UPLOADED' CHECK(status IN ('UPLOADED','PROCESSING','PARSED','FAILED')),
 parsed_content jsonb,
 parser_version varchar(30),
 parse_token uuid,
 parse_started_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,sha256),
 CHECK(parsed_content IS NULL OR jsonb_typeof(parsed_content)='object')
);
ALTER TABLE candidate.resumes
 ADD COLUMN source_document_id uuid REFERENCES candidate.resume_documents(id),
 ADD COLUMN extra_sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(extra_sections)='array');
ALTER TABLE recruitment.applications
 ADD COLUMN submission_format varchar(20) NOT NULL DEFAULT 'BUILDER' CHECK(submission_format IN ('BUILDER','ORIGINAL_PDF')),
 ADD COLUMN source_document_id uuid REFERENCES candidate.resume_documents(id),
 ADD CONSTRAINT original_pdf_requires_document CHECK(submission_format <> 'ORIGINAL_PDF' OR source_document_id IS NOT NULL);
CREATE FUNCTION recruitment.protect_submitted_pdf() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.submission_format IS DISTINCT FROM OLD.submission_format OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id THEN
  RAISE EXCEPTION 'Submitted CV document is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER applications_pdf_immutable BEFORE UPDATE ON recruitment.applications
 FOR EACH ROW EXECUTE FUNCTION recruitment.protect_submitted_pdf();
CREATE FUNCTION candidate.protect_original_pdf() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='PARSED' AND NEW.parsed_content IS DISTINCT FROM OLD.parsed_content THEN
  RAISE EXCEPTION 'Parsed original is immutable';
 END IF;
 IF NEW.content IS DISTINCT FROM OLD.content OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id THEN
  RAISE EXCEPTION 'Original CV document is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resume_documents_original_immutable BEFORE UPDATE ON candidate.resume_documents
 FOR EACH ROW EXECUTE FUNCTION candidate.protect_original_pdf();
