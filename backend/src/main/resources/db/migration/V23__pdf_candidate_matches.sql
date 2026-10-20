-- PDF assessments have their own keys; keep historical web-CV matches untouched.
CREATE TABLE recruitment.candidate_pdf_job_matches (
    LIKE recruitment.candidate_job_matches INCLUDING DEFAULTS INCLUDING CONSTRAINTS
);
ALTER TABLE recruitment.candidate_pdf_job_matches RENAME COLUMN resume_id TO document_id;
ALTER TABLE recruitment.candidate_pdf_job_matches RENAME COLUMN resume_version TO document_version;
ALTER TABLE recruitment.candidate_pdf_job_matches
    ADD PRIMARY KEY(candidate_id,job_id,document_id),
    ADD FOREIGN KEY(job_id) REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
    ADD FOREIGN KEY(document_id,candidate_id) REFERENCES candidate.resume_documents(id,candidate_id);
CREATE INDEX candidate_pdf_matches_owner_idx ON recruitment.candidate_pdf_job_matches(candidate_id,updated_at DESC);
