-- Internal review data stays separate from immutable submitted CV/JD evidence.
CREATE TABLE recruitment.application_notes (
 id uuid PRIMARY KEY,
 application_id uuid NOT NULL REFERENCES recruitment.applications(id),
 author_id uuid NOT NULL REFERENCES auth.users(id),
 author_name varchar(255) NOT NULL,
 body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 4000),
 request_id uuid NOT NULL,
 created_at timestamptz NOT NULL,
 CONSTRAINT application_note_request_unique UNIQUE (application_id, request_id)
);
CREATE INDEX application_notes_timeline_idx ON recruitment.application_notes(application_id,created_at,id);
CREATE TRIGGER application_notes_immutable BEFORE UPDATE OR DELETE ON recruitment.application_notes
 FOR EACH ROW EXECUTE FUNCTION recruitment.reject_evidence_change();
-- New entries preserve the actor's display name at the time of the action.
-- Older immutable entries continue to resolve the name from auth.users.
ALTER TABLE recruitment.application_status_history ADD COLUMN actor_name varchar(255);
