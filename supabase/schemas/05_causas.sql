create table public.causas (
  id                  uuid        not null default gen_random_uuid() primary key,
  codigo              text        not null unique,
  nombre              text        not null,
  definicion          text,
  emociones_esperadas text,
  activo              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.causas is 'Catálogo de causas diagnósticas; cada etapa de tratamiento tiene exactamente una causa.';

alter table public.causas enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_causas_updated_at
  before update on public.causas
  for each row execute function public.set_updated_at();
