-- Dismissals de alertas clínicas derivadas (nunca reaparecen). Portado de v1
-- (feat/alertas:supabase/schemas/64_alertas_atendidas.sql) con un cambio: el
-- `check (tipo in (...))` de v1 se reemplaza por una FK a
-- public.tipos_alerta (codigo) (task 0.1). RLS null-safe idéntica a v1.
--
-- Escrita a mano (no via `supabase db diff`): el diff en frío está roto por
-- un bug pre-existente contra 11_profiles/25_admin_functions. Mirrors
-- supabase/schemas/64_alertas_atendidas.sql exactamente.

create table public.alertas_atendidas (
  id            uuid        not null default gen_random_uuid() primary key,
  tipo          text        not null references public.tipos_alerta (codigo),
  evento_ref    text        not null,
  paciente_id   uuid        not null references public.pacientes (id),
  terapeuta_id  uuid        not null references public.terapeutas (id),
  atendida_por  uuid        not null,
  atendida_en   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (tipo, evento_ref, paciente_id)
);

comment on table public.alertas_atendidas is 'Dismissals de alertas clínicas derivadas (nunca reaparecen); unique(tipo, evento_ref, paciente_id) garantiza idempotencia del marcado y hace paciente_id parte de la identidad del dismissal (defense-in-depth: un dismissal forjado con el evento_ref de otro paciente no lo afecta).';

alter table public.alertas_atendidas enable row level security;

