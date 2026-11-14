-- Manual migration: `supabase db diff` is broken in this repo (bug de orden con
-- is_admin()). See supabase/schemas/16_causa_frases.sql and
-- supabase/schemas/17_algoritmo_frases.sql for the declarative source of truth.

create table public.causa_frases (
  causa_id uuid    not null references public.causas (id),
  orden    integer not null,
  texto    text    not null,
  primary key (causa_id, orden)
);

comment on table public.causa_frases is 'Catálogo de frases motivacionales derivadas por causa, ordenadas por posición. NO confundir con causa_etapas, que guarda la "frase esperada" (objetivo de evaluación) por etapa de tratamiento.';

alter table public.causa_frases enable row level security;

create table public.algoritmo_frases (
  algoritmo_id uuid    not null references public.algoritmos (id),
  orden        integer not null,
  texto        text    not null,
  primary key (algoritmo_id, orden)
);

comment on table public.algoritmo_frases is 'Catálogo de frases motivacionales derivadas por algoritmo, ordenadas por posición. NO confundir con algoritmo_etapas, que guarda la "frase esperada" (objetivo de evaluación) por etapa de tratamiento.';

alter table public.algoritmo_frases enable row level security;

