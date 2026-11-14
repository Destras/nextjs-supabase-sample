create table public.roles (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.roles is 'Catálogo de roles de usuario de la aplicación (admin, terapeuta, paciente).';

alter table public.roles enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();
