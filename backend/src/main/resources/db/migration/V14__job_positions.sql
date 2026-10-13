CREATE TABLE recruitment.job_positions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES recruitment.departments(id),
    name varchar(150) NOT NULL CHECK (name = btrim(name) AND name <> ''),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, department_id)
);
CREATE UNIQUE INDEX job_positions_department_name_unique
    ON recruitment.job_positions(department_id, lower(name));
CREATE TRIGGER job_positions_updated_at BEFORE UPDATE ON recruitment.job_positions
    FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();

-- Existing titles remain unchanged. Legacy jobs can choose a position when edited.
ALTER TABLE recruitment.jobs ADD COLUMN position_id uuid;
ALTER TABLE recruitment.jobs ADD CONSTRAINT jobs_position_department_fk
    FOREIGN KEY (position_id, department_id)
    REFERENCES recruitment.job_positions(id, department_id);
CREATE INDEX jobs_position_idx ON recruitment.jobs(position_id);

-- Initial company catalog, scoped to recognized departments already present.
-- Do not create departments or infer a position from an existing job title.
INSERT INTO recruitment.job_positions(department_id, name)
SELECT d.id, p.name
FROM recruitment.departments d
JOIN (VALUES
    ('tech', 'Frontend Developer'), ('tech', 'Backend Developer'),
    ('tech', 'Fullstack Developer'), ('tech', 'Mobile Developer'),
    ('tech', 'QA Engineer'), ('tech', 'DevOps Engineer'), ('tech', 'Business Analyst'),
    ('design', 'UI/UX Designer'), ('design', 'Product Designer'),
    ('data', 'Data Analyst'), ('data', 'Data Engineer'), ('data', 'AI Engineer'),
    ('marketing', 'Content Marketing'), ('marketing', 'Digital Marketing'),
    ('sales', 'Sales Executive'), ('sales', 'Account Manager')
) AS p(group_name, name) ON p.group_name = CASE
    WHEN lower(btrim(d.name)) IN ('it', 'công nghệ', 'công nghệ thông tin', 'engineering') THEN 'tech'
    WHEN lower(btrim(d.name)) IN ('thiết kế', 'design') THEN 'design'
    WHEN lower(btrim(d.name)) IN ('dữ liệu & ai', 'dữ liệu', 'data & ai') THEN 'data'
    WHEN lower(btrim(d.name)) = 'marketing' THEN 'marketing'
    WHEN lower(btrim(d.name)) IN ('kinh doanh', 'sales') THEN 'sales'
END;
