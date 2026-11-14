create table public.tipos_alerta (
  codigo      text    not null primary key,
  nombre      text    not null,
  prioridad   text    not null check (prioridad in ('alta', 'media', 'baja')),
  orden       int     not null,
  icono       text    not null,
  descripcion text,
  activo      boolean not null default true,
  descartable boolean not null default true
);

comment on table public.tipos_alerta is 'Catálogo de metadata de presentación de los tipos de alerta (score_bajo, eval_vencida, mes_3, fin, reinicio, medicion_cierre_pendiente). No dispara nada por sí solo: la lógica de cuándo se activa cada tipo vive en derive_alertas_activas().';

comment on column public.tipos_alerta.descartable is
  'Si el terapeuta puede marcar la alerta como atendida (marcar_alerta_atendida, DEC-32 medir-chakras) — catálogo, reemplaza el allowlist hardcodeado anterior. Default true reproduce exactamente el comportamiento previo para los 5 tipos preexistentes; medicion_cierre_pendiente es el único false (defense in depth: no debe poder descartarse, solo se resuelve cerrando la etapa con medición).';

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

-- 'reinicio' (feat/nuevoTratamiento, DEC-33) reincorporado acá: hasta ahora
-- solo existía en la migración 20260707040500_tipos_alerta_baja.sql
-- (divergencia preexistente, H3) — este insert devuelve a schemas/ su rol de
-- fuente de verdad para las 5 filas del catálogo.
--
-- 'contenido_pendiente' (feat/inicioTratamiento, DEC-E0-6) vivió acá y se dio
-- de baja por DEC-12 (post-implementación, feat/inicio-tratamiento):
-- redundante con el widget "Sin iniciar" del dashboard del terapeuta; el
-- admin conserva visibilidad via list_terapeutas.sin_iniciar en su lugar. Ver
-- la migración 20260713153300_drop_alerta_contenido_pendiente.sql para el
-- delete idempotente de la fila y sus dismissals.
insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono) values
  ('reinicio', 'Reinicio de tratamiento', 'baja', 5, '↻')
on conflict (codigo) do nothing;

-- 'medicion_cierre_pendiente' (medir-chakras, DEC-32/DEC-33): la etapa activa
-- entró en su última semana y todavía no tiene la medición de cierre.
-- descartable = false a propósito (OD-3, prioridad/icono provisionales,
-- owner /aurora-ui): no es un aviso informativo que el terapeuta pueda tildar
-- y olvidar, es un recordatorio de una obligación clínica pendiente — se
-- resuelve cerrando la etapa con cerrar_etapa_con_medicion, nunca marcando
-- "atendida".
insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono, descartable) values
  ('medicion_cierre_pendiente', 'Medición de cierre pendiente', 'alta', 6, '◎', false)
on conflict (codigo) do nothing;
