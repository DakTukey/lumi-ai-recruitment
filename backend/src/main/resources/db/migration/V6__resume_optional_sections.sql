ALTER TABLE candidate.resumes
    ADD COLUMN languages jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(languages) = 'array'),
    ADD COLUMN awards jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(awards) = 'array'),
    ADD COLUMN activities jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(activities) = 'array');
