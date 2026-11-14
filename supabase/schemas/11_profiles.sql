create table public.profiles (
  id         uuid        not null primary key references auth.users (id) on delete cascade,
  nombre     text,
  rol_id     uuid        references public.roles (id),
  timezone   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Extiende auth.users con datos de la aplicación; fuente de verdad del rol de cada usuario.';

alter table public.profiles enable row level security;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).
