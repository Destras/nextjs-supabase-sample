-- Catálogo de metadata de presentación de los tipos de alerta (score_bajo,
-- eval_vencida, mes_3, fin). No dispara nada por sí solo: la lógica de
-- cuándo se activa cada tipo vive en derive_alertas_activas() (task 0.3).
--
-- Escrita a mano (no via `supabase db diff`): el diff en frío está roto por
-- un bug pre-existente contra 11_profiles/25_admin_functions. Mirrors
-- supabase/schemas/63_tipos_alerta.sql exactamente.

create table public.tipos_alerta (
  codigo      text    not null primary key,
  nombre      text    not null,
  prioridad   text    not null check (prioridad in ('alta', 'media')),
  orden       int     not null,
  icono       text    not null,
  descripcion text,
  activo      boolean not null default true
);

comment on table public.tipos_alerta is 'Catálogo de metadata de presentación de los tipos de alerta (score_bajo, eval_vencida, mes_3, fin). No dispara nada por sí solo: la lógica de cuándo se activa cada tipo vive en derive_alertas_activas().';

alter table public.tipos_alerta enable row level security;

-- Dato de referencia, no de ejemplo: las 4 filas base deben existir dondequiera
-- que corran las migraciones (incluido `db push`, que NO corre supabase/seed.sql).
-- alertas_atendidas.tipo tiene FK a tipos_alerta(codigo); sin estas filas,
-- marcar_alerta_atendida viola la FK en un entorno migration-only (ALE-001).
-- Idempotente: re-aplicar no duplica ni falla.
insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono) values
  ('score_bajo',   'Score bajo',         'alta',  1, '↘'),
  ('eval_vencida', 'Evaluación vencida', 'media', 2, '?'),
  ('mes_3',        'Mes 3',              'media', 3, '✦'),
  ('fin',          'Cerca del cierre',   'media', 4, '✦')
on conflict (codigo) do nothing;
