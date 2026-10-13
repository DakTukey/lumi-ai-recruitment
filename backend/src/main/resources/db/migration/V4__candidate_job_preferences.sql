ALTER TABLE candidate.candidate_profiles
 ADD COLUMN employment_types jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN work_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN preferred_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN experience_range varchar(30),
 ADD COLUMN position_undecided boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT candidate_employment_types_check CHECK (jsonb_typeof(employment_types)='array' AND employment_types <@ '["FULL_TIME","PART_TIME","INTERNSHIP","CONTRACT"]'::jsonb),
 ADD CONSTRAINT candidate_work_modes_check CHECK (jsonb_typeof(work_modes)='array' AND work_modes <@ '["ONSITE","HYBRID","REMOTE"]'::jsonb),
 ADD CONSTRAINT candidate_locations_check CHECK (jsonb_typeof(preferred_locations)='array'),
 ADD CONSTRAINT candidate_experience_range_check CHECK (experience_range IS NULL OR experience_range IN ('NONE','UNDER_ONE','ONE_TO_THREE','THREE_TO_FIVE','FIVE_PLUS'));
ALTER TABLE candidate.candidate_profiles ALTER COLUMN experience_years DROP DEFAULT;
-- Preserve exact legacy years; do not infer whether a legacy zero was an answer or a default.
UPDATE candidate.candidate_profiles SET experience_range = CASE
 WHEN experience_years < 1 THEN 'UNDER_ONE'
 WHEN experience_years < 3 THEN 'ONE_TO_THREE'
 WHEN experience_years < 5 THEN 'THREE_TO_FIVE'
 ELSE 'FIVE_PLUS' END WHERE experience_years > 0;
-- The meaning/order of steps changed; retain answers and restart unfinished journeys.
UPDATE candidate.candidate_profiles SET onboarding_step=0 WHERE onboarding_status='IN_PROGRESS';
