-- A candidate may submit an owned PDF without creating a Builder CV.
ALTER TABLE recruitment.applications ALTER COLUMN resume_id DROP NOT NULL;
ALTER TABLE candidate.resume_documents ADD CONSTRAINT resume_documents_id_candidate_unique UNIQUE (id, candidate_id);
ALTER TABLE candidate.resume_documents ADD COLUMN display_name varchar(100);
UPDATE candidate.resume_documents SET display_name = coalesce(nullif(btrim(left(filename, 100)), ''), 'CV PDF');
ALTER TABLE candidate.resume_documents ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE candidate.resume_documents ADD CONSTRAINT resume_document_display_name_nonblank CHECK (length(btrim(display_name)) > 0);
ALTER TABLE candidate.candidate_profiles ADD COLUMN default_document_id uuid;
ALTER TABLE candidate.candidate_profiles ADD CONSTRAINT candidate_default_document_owner_fk
 FOREIGN KEY (default_document_id, user_id) REFERENCES candidate.resume_documents(id, candidate_id);
ALTER TABLE recruitment.applications ADD CONSTRAINT application_document_owner_fk
 FOREIGN KEY (source_document_id, candidate_id) REFERENCES candidate.resume_documents(id, candidate_id);
ALTER TABLE recruitment.applications ADD CONSTRAINT application_source_required CHECK (
 (submission_format = 'BUILDER' AND resume_id IS NOT NULL)
 OR (submission_format = 'ORIGINAL_PDF' AND source_document_id IS NOT NULL)
);
