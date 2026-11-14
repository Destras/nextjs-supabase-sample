create table public.tipos_disco (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.tipos_disco is 'Catálogo de tipos de disco terapéutico (Río, Bosque, Agua y similares).';

alter table public.tipos_disco enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_tipos_disco_updated_at
  before update on public.tipos_disco
  for each row execute function public.set_updated_at();
