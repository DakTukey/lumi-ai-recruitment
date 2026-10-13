-- V17: Cache kết quả AI đối chiếu CV ứng viên với JD (Candidate Pre-application Job Match)
-- Bảng lưu kết quả theo (candidate_id, job_id, resume_id). Cập nhật khi CV hoặc JD đổi phiên bản.

CREATE TABLE IF NOT EXISTS recruitment.candidate_job_matches (
    candidate_id uuid NOT NULL REFERENCES candidate.candidate_profiles(user_id) ON DELETE CASCADE,
    job_id uuid NOT NULL REFERENCES recruitment.jobs(id) ON DELETE CASCADE,
    resume_id uuid NOT NULL REFERENCES candidate.resumes(id) ON DELETE CASCADE,
    job_version bigint NOT NULL DEFAULT 0,
    resume_version bigint NOT NULL DEFAULT 0,
    score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    summary text NOT NULL,
    criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array'),
    gaps jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(gaps) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT candidate_job_matches_pk PRIMARY KEY (candidate_id, job_id, resume_id)
);

CREATE INDEX IF NOT EXISTS candidate_job_matches_candidate_idx
    ON recruitment.candidate_job_matches(candidate_id, updated_at DESC);

COMMENT ON TABLE recruitment.candidate_job_matches IS
    'Kết quả AI đối chiếu CV của ứng viên với tin tuyển dụng trước khi ứng tuyển. Caching per candidate, job, resume.';

-- Seed ít nhất 1 tin tuyển dụng thật ở trạng thái PUBLISHED với đầy đủ kỹ năng và tiêu chí để kiểm thử
DO $$
DECLARE
    v_dept_id uuid;
    v_creator_id uuid;
    v_pos_id uuid;
    v_job_id uuid := '7a8f12c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c'::uuid;
    v_skill_java uuid;
    v_skill_spring uuid;
    v_skill_postgres uuid;
    v_skill_docker uuid;
    v_skill_git uuid;
    v_skill_rest uuid;
BEGIN
    SELECT id INTO v_dept_id FROM recruitment.departments WHERE is_active LIMIT 1;
    SELECT id INTO v_creator_id FROM auth.users WHERE role IN ('RECRUITER', 'COMPANY_ADMIN') LIMIT 1;
    SELECT id INTO v_pos_id FROM recruitment.job_positions WHERE name = 'Backend Developer' AND department_id = v_dept_id LIMIT 1;

    IF v_dept_id IS NOT NULL AND v_creator_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recruitment.jobs WHERE id = v_job_id) THEN
        INSERT INTO recruitment.jobs (
            id, department_id, created_by, position_id, title,
            description, requirements, benefits, skills, location,
            employment_type, work_mode, experience_level,
            salary_min, salary_max, currency, status, featured,
            headcount, version, published_at, application_deadline, created_at, updated_at
        ) VALUES (
            v_job_id, v_dept_id, v_creator_id, v_pos_id,
            'Backend Developer (Java / Spring Boot)',
            'Tham gia phát triển và tối ưu hóa hệ thống backend tuyển dụng thông minh Lumi Studio. Thiết kế và hiện thực hóa các RESTful API hiệu năng cao, mở rộng vi dịch vụ kết nối với AI Service.',
            '- Có từ 1-2 năm kinh nghiệm làm việc với Java và Spring Boot.
- Thành thạo thiết kế cơ sở dữ liệu quan hệ (PostgreSQL) và tối ưu truy vấn SQL.
- Hiểu biết về kiến trúc RESTful API, Docker containerization và Git version control.
- Có tinh thần học hỏi, chủ động giải quyết vấn đề và kỹ năng làm việc nhóm tốt.',
            '- Mức lương cạnh tranh từ 15 - 28 triệu VNĐ/tháng theo năng lực.
- Thưởng hiệu quả dự án, thưởng lễ tết và lương tháng 13.
- Bảo hiểm sức khỏe cao cấp, khám sức khỏe định kỳ hàng năm.
- Môi trường làm việc năng động, trang bị laptop cấu hình cao, cơ hội tiếp cận công nghệ AI tiên tiến.',
            'Java, Spring Boot, PostgreSQL, Docker, Git, REST API',
            'Đà Nẵng',
            'FULL_TIME',
            'HYBRID',
            'JUNIOR',
            15000000,
            28000000,
            'VND',
            'PUBLISHED',
            true,
            2,
            0,
            now() - interval '1 hour',
            now() + interval '60 days',
            now() - interval '1 hour',
            now() - interval '1 hour'
        );

        -- Gắn kỹ năng vào job_skills
        SELECT id INTO v_skill_java FROM catalog.skills WHERE normalized_name = 'java' LIMIT 1;
        SELECT id INTO v_skill_spring FROM catalog.skills WHERE normalized_name = 'spring boot' LIMIT 1;
        SELECT id INTO v_skill_postgres FROM catalog.skills WHERE normalized_name = 'postgresql' LIMIT 1;
        SELECT id INTO v_skill_docker FROM catalog.skills WHERE normalized_name = 'docker' LIMIT 1;
        SELECT id INTO v_skill_git FROM catalog.skills WHERE normalized_name = 'git' LIMIT 1;
        SELECT id INTO v_skill_rest FROM catalog.skills WHERE normalized_name = 'rest api' LIMIT 1;

        IF v_skill_java IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_java, true) ON CONFLICT DO NOTHING;
        END IF;
        IF v_skill_spring IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_spring, true) ON CONFLICT DO NOTHING;
        END IF;
        IF v_skill_postgres IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_postgres, true) ON CONFLICT DO NOTHING;
        END IF;
        IF v_skill_docker IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_docker, false) ON CONFLICT DO NOTHING;
        END IF;
        IF v_skill_git IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_git, true) ON CONFLICT DO NOTHING;
        END IF;
        IF v_skill_rest IS NOT NULL THEN
            INSERT INTO recruitment.job_skills(job_id, skill_id, is_required) VALUES (v_job_id, v_skill_rest, true) ON CONFLICT DO NOTHING;
        END IF;

        -- Gắn tiêu chí tuyển dụng vào job_requirements
        INSERT INTO recruitment.job_requirements(id, job_id, type, description, is_required, weight, sort_order)
        VALUES
            (gen_random_uuid(), v_job_id, 'EXPERIENCE', 'Có từ 1-2 năm kinh nghiệm phát triển phần mềm backend Java / Spring Boot', true, 3, 1),
            (gen_random_uuid(), v_job_id, 'EDUCATION', 'Tốt nghiệp Đại học/Cao đẳng chuyên ngành Công nghệ thông tin hoặc tương đương', false, 1, 2),
            (gen_random_uuid(), v_job_id, 'OTHER', 'Có khả năng làm việc nhóm, trao đổi kỹ thuật rõ ràng và trách nhiệm với sản phẩm', true, 2, 3);
    END IF;
END $$;
