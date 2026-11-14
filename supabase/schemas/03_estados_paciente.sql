create table public.estados_paciente (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.estados_paciente is 'Catálogo de estados operacionales del paciente (activo, pausado, baja_voluntaria).';

alter table public.estados_paciente enable row level security;

create trigger set_estados_paciente_updated_at
  before update on public.estados_paciente
  for each row execute function public.set_updated_at();

-- Dato de referencia, no de ejemplo (baja-voluntaria-cuenta-paciente, Fase 1):
-- baja_voluntaria_paciente resuelve este código por slug. Va acá (no en
-- seed.sql) por el mismo precedente que 'pendiente' en 04_estados_etapa.sql:
-- seed.sql no corre en un entorno db push. DML no capturado por
-- `supabase db diff`; el insert real lo aplica la migración versionada
-- <ts>_seed_estado_baja_voluntaria.sql — este bloque es solo el mirror
-- idempotente del estado deseado.
insert into public.estados_paciente (id, codigo, nombre, descripcion) values
  ('a3000003-0000-0000-0000-000000000000', 'baja_voluntaria', 'Baja voluntaria',
   'El paciente eliminó su propia cuenta desde la app; la ficha clínica se conserva')
on conflict (codigo) do nothing;
