create table public.contenidos (
  id           uuid        not null default gen_random_uuid() primary key,
  tipo         text        not null,
  titulo       text        not null,
  descripcion  text,
  recurso_ref  text,
  duracion_seg integer,
  metadata     jsonb,
  activo       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.contenidos is 'Biblioteca de contenidos entregables al paciente (video, audio, texto).';

alter table public.contenidos enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).

create trigger set_contenidos_updated_at
  before update on public.contenidos
  for each row execute function public.set_updated_at();

-- paciente_puede_ver_objeto (SEG-002) busca el contenido por la ruta del objeto.
create index contenidos_recurso_ref_idx
  on public.contenidos using btree (recurso_ref)
  where recurso_ref is not null;
