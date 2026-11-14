create table public.estados_terapeuta (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.estados_terapeuta is 'Catálogo de estados operacionales del terapeuta (activo, suspendido).';

alter table public.estados_terapeuta enable row level security;

create trigger set_estados_terapeuta_updated_at
  before update on public.estados_terapeuta
  for each row execute function public.set_updated_at();
