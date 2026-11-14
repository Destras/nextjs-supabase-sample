create table public.alfabetos (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  rango_max   smallint    not null check (rango_max >= 1),
  orden       smallint    not null unique
);

comment on table public.alfabetos is 'Catálogo cerrado de los 8 alfabetos del método. Cada uno admite los números del 1 a rango_max (ADR 0015); orden fija cómo se muestran (1..8).';

alter table public.alfabetos enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_alfabetos_updated_at
  before update on public.alfabetos
  for each row execute function public.set_updated_at();
