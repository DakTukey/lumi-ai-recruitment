DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL THEN
        RAISE EXCEPTION 'Both public.users and auth.users exist; resolve the conflict before migration';
    END IF;
    IF to_regclass('public.candidate_profiles') IS NOT NULL
       AND to_regclass('candidate.candidate_profiles') IS NOT NULL THEN
        RAISE EXCEPTION 'Both public.candidate_profiles and candidate.candidate_profiles exist; resolve the conflict before migration';
    END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS candidate;

DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        ALTER TABLE public.users SET SCHEMA auth;
    ELSIF to_regclass('auth.users') IS NULL THEN
        CREATE TABLE auth.users (
            id UUID NOT NULL,
            created_at TIMESTAMP(6) WITH TIME ZONE,
            email VARCHAR(255) NOT NULL,
            full_name VARCHAR(150) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL,
            CONSTRAINT users_pkey PRIMARY KEY (id),
            CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email),
            CONSTRAINT users_role_check CHECK (role IN ('CANDIDATE', 'RECRUITER', 'COMPANY_ADMIN')),
            CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'))
        );
        CREATE INDEX idx_users_email ON auth.users (email);
        CREATE INDEX idx_users_role ON auth.users (role);
    END IF;

    IF to_regclass('public.candidate_profiles') IS NOT NULL THEN
        ALTER TABLE public.candidate_profiles SET SCHEMA candidate;
    ELSIF to_regclass('candidate.candidate_profiles') IS NULL THEN
        CREATE TABLE candidate.candidate_profiles (
            user_id UUID NOT NULL,
            experience_years NUMERIC(4,1),
            headline VARCHAR(255),
            phone VARCHAR(30),
            skills TEXT,
            updated_at TIMESTAMP(6) WITH TIME ZONE,
            CONSTRAINT candidate_profiles_pkey PRIMARY KEY (user_id),
            CONSTRAINT fkn7b2se0y378uox9e3aw2bjg13 FOREIGN KEY (user_id) REFERENCES auth.users (id)
        );
    END IF;
END
$$;
