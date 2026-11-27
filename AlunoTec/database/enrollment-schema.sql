-- Preparação para PostgreSQL/Supabase. Não executar automaticamente no navegador.
-- A API autenticada deve mapear estas tabelas ao contrato documentado.
-- As turmas continuam no cadastro canônico existente; não há segunda lista de turmas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.alunotec_polos (
    institution_id uuid NOT NULL,
    id text NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (institution_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS alunotec_polo_active_name
    ON public.alunotec_polos (institution_id, normalized_name)
    WHERE NOT archived;

CREATE TABLE IF NOT EXISTS public.alunotec_students (
    institution_id uuid NOT NULL,
    id text NOT NULL,
    personal jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (institution_id, id),
    CHECK (jsonb_typeof(personal) = 'object'),
    CHECK (coalesce(length(trim(personal ->> 'name')), 0) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS alunotec_student_cpf
    ON public.alunotec_students (
        institution_id,
        regexp_replace(personal ->> 'cpf', '[^0-9]', '', 'g')
    )
    WHERE coalesce(personal ->> 'cpf', '') <> '';

CREATE TABLE IF NOT EXISTS public.alunotec_enrollments (
    institution_id uuid NOT NULL,
    id text NOT NULL,
    student_id text NOT NULL,
    polo_id text NOT NULL,
    school_year integer NOT NULL CHECK (school_year BETWEEN 1900 AND 9999),
    registration jsonb NOT NULL,
    health jsonb NOT NULL,
    polo_history jsonb NOT NULL DEFAULT '[]'::jsonb,
    form_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (institution_id, id),
    UNIQUE (institution_id, student_id, school_year),
    UNIQUE (institution_id, id, student_id),
    FOREIGN KEY (institution_id, student_id)
        REFERENCES public.alunotec_students (institution_id, id)
        ON DELETE RESTRICT,
    FOREIGN KEY (institution_id, polo_id)
        REFERENCES public.alunotec_polos (institution_id, id)
        ON DELETE RESTRICT,
    CHECK (jsonb_typeof(registration) = 'object'),
    CHECK (jsonb_typeof(health) = 'object'),
    CHECK (jsonb_typeof(polo_history) = 'array')
);

CREATE TABLE IF NOT EXISTS public.alunotec_enrollment_class_links (
    institution_id uuid NOT NULL,
    student_id text NOT NULL,
    enrollment_id text NOT NULL,
    class_id text NOT NULL,
    class_type text NOT NULL CHECK (class_type IN ('base', 'electives')),
    member_id text NOT NULL,
    PRIMARY KEY (institution_id, enrollment_id, class_id, class_type),
    FOREIGN KEY (institution_id, enrollment_id, student_id)
        REFERENCES public.alunotec_enrollments (institution_id, id, student_id)
        ON DELETE RESTRICT
);

-- class_id referencia o ID da turma já existente em alunotec_turmas.payload.
-- Como o cadastro atual é JSON, essa existência e o ano devem ser validados
-- pela API em transação. Quando houver uma tabela canônica normalizada de
-- turmas, adicionar a FK para essa tabela, sem recriar o catálogo de turmas.
CREATE TABLE IF NOT EXISTS public.alunotec_enrollment_revisions (
    institution_id uuid PRIMARY KEY,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sem políticas de leitura pública. As permissões da instituição e dos
-- perfis administrativos devem ser implementadas no serviço autenticado.
ALTER TABLE public.alunotec_polos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunotec_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunotec_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunotec_enrollment_class_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunotec_enrollment_revisions ENABLE ROW LEVEL SECURITY;
COMMIT;
