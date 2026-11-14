create table public.estados_etapa (
  id          uuid        not null default gen_random_uuid() primary key,
  codigo      text        not null unique,
  nombre      text        not null,
  descripcion text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.estados_etapa is 'Catálogo del ciclo de vida de una etapa de tratamiento (pendiente, activa, finalizada, abandonada).';

alter table public.estados_etapa enable row level security;

create trigger set_estados_etapa_updated_at
  before update on public.estados_etapa
  for each row execute function public.set_updated_at();

-- Dato de referencia, no de ejemplo: register_paciente resuelve 'pendiente'
-- por slug y lanza excepción si no existe (feature inicioTratamiento, DEC-E0-6).
-- Va acá (no en seed.sql) por el mismo precedente que tipos_alerta (ALE-001,
-- ver 63_tipos_alerta.sql:21-25): seed.sql no corre en un entorno db push.
-- No colisiona con seed.sql: no trunca estados_etapa y usa UUIDs fijos distintos
-- (a4000001..3 = activa/finalizada/abandonada).
insert into public.estados_etapa (id, codigo, nombre, descripcion) values
  ('a4000004-0000-0000-0000-000000000000', 'pendiente', 'Pendiente',
   'Etapa creada, esperando la carga del contenido para arrancar')
on conflict (codigo) do nothing;
