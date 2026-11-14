create table public.algoritmos (
  id            uuid        not null default gen_random_uuid() primary key,
  codigo        text        not null unique,
  nombre        text        not null,
  definicion    text,
  comportamiento text,
  activo        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.algoritmos is 'Catálogo de 62 algoritmos patológicos distribuidos en 18 cuerpos energéticos.';

alter table public.algoritmos enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_algoritmos_updated_at
  before update on public.algoritmos
  for each row execute function public.set_updated_at();
