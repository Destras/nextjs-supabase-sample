create table public.bloqueos (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.bloqueos is 'Catálogo de los 12 centros energéticos (chakras) que pueden estar bloqueados.';

alter table public.bloqueos enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_bloqueos_updated_at
  before update on public.bloqueos
  for each row execute function public.set_updated_at();
