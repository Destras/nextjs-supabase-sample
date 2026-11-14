create table public.modalidades (
  id                      uuid        not null default gen_random_uuid() primary key,
  codigo                  text        not null unique,
  nombre                  text        not null,
  tipo_disco_id           uuid        references public.tipos_disco (id),
  cantidad_sesiones       integer,
  cantidad_niveles        integer     not null,
  cadencia_descripcion    text,
  duracion_meses_estimada integer,
  activo                  boolean     not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.modalidades is 'Combinaciones de tratamiento; determina la cantidad de niveles y duración estimada de una etapa.';

alter table public.modalidades enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_modalidades_updated_at
  before update on public.modalidades
  for each row execute function public.set_updated_at();
