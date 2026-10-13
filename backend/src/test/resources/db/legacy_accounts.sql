CREATE TABLE public.users (
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
CREATE INDEX idx_users_email ON public.users (email);
CREATE INDEX idx_users_role ON public.users (role);
CREATE TABLE public.candidate_profiles (
    user_id UUID NOT NULL,
    experience_years NUMERIC(4,1),
    headline VARCHAR(255),
    phone VARCHAR(30),
    skills TEXT,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT candidate_profiles_pkey PRIMARY KEY (user_id),
    CONSTRAINT fkn7b2se0y378uox9e3aw2bjg13 FOREIGN KEY (user_id) REFERENCES public.users (id)
);
