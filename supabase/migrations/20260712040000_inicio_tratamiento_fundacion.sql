-- Fundación transversal de inicioTratamiento (Epic 0, Task 0.1): habilita a
-- la base de datos a representar una etapa de tratamiento "creada pero sin
-- arrancar" — hoy `fecha_inicio` no admite NULL y el reloj clínico arranca
-- de prepo en el alta.
--
-- `db diff` está ROTO en este ambiente (bug de ordering preexistente:
-- is_admin() se usa en 11_profiles.sql antes de definirse en
-- 25_admin_functions.sql, lo que aborta el build de la shadow-db). Esta
-- migración fue hand-authored, como las ~13 que ya existen (ver
-- 20260707040500_tipos_alerta_baja.sql). Excepción declarada a
-- .claude/supabase-declarative-database-schema.md §3.
--
-- 1. DDL: fecha_inicio pasa a nullable.
alter table public.etapas_tratamiento
  alter column fecha_inicio drop not null;

comment on column public.etapas_tratamiento.fecha_inicio is
  'fecha_inicio IS NULL ⟺ la etapa fue creada pero no arrancó; es la única fuente de verdad de "sin iniciar" (per DEC-3 del ProductSpec de inicioTratamiento — el estado pendiente acompaña pero no deriva nada).';

-- 2. Catálogo: estado `pendiente` (per DEC-E0-6). UUID fijo, serie
-- a4000001..3 = activa/finalizada/abandonada (ya usada por seed.sql).
insert into public.estados_etapa (id, codigo, nombre, descripcion) values
  ('a4000004-0000-0000-0000-000000000000', 'pendiente', 'Pendiente',
   'Etapa creada, esperando la carga del contenido para arrancar')
on conflict (codigo) do nothing;

-- 3. Catálogo: tipos de alerta `reinicio` (faltante en schemas/, H3) y
-- `contenido_pendiente` (nuevo, per DEC-E0-6). El check de prioridad ya
-- admite 'baja' desde 20260707040500_tipos_alerta_baja.sql.
insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono) values
  ('reinicio',            'Reinicio de tratamiento', 'baja',  5, '↻'),
  ('contenido_pendiente', 'Contenido pendiente',     'media', 6, '◷')
on conflict (codigo) do nothing;

-- 4. Backfill defensivo (per DEC-8 y DEC-E0-2).
--
-- Etapa abierta, SIN PROGRESO REAL, cuyo plan de contenido NO está completo
-- → vuelve a "sin iniciar". El gate de frescura es obligatorio (per
-- DEC-E1-3): sin él, una etapa que ya arrancó y tiene meses de progreso
-- real (evaluaciones respondidas, seguimiento real) quedaría revertida a
-- NULL solo porque en el camino se le borró una semana del plan — eso
-- contradice DEC-5 (el arranque es irreversible porque "retroceder el
-- reloj corrompería meses de historia y evaluaciones ya hechas").
--
-- CONTRATO CRÍTICO: la completitud del plan se evalúa llamando a
-- public.etapa_plan_completo(e.id) — PROHIBIDO inlinear su regla de slots
-- (count(distinct orden) = 3). feat/frases-automaticas va a redefinir esa
-- función a 2 slots; si acá se copiara la regla, el plan nunca quedaría
-- completo y el tratamiento nunca arrancaría (deadlock silencioso). La
-- función es el seam.
update public.etapas_tratamiento as e
   set fecha_inicio = null,
       estado_id    = (select ee.id from public.estados_etapa as ee where ee.codigo = 'pendiente')
 where e.fecha_finalizacion is null
   and not public.etapa_plan_completo(e.id)
   -- gate de frescura: mismo criterio que update_etapa_diagnostico (71_rpcs_pacientes.sql:330)
   and not exists (
     select 1 from public.niveles as n
      where n.etapa_id = e.id and n.fecha_seguimiento_real is not null
   )
   and not exists (
     select 1 from public.nivel_evaluacion as ev
       join public.niveles as n on n.id = ev.nivel_id
      where n.etapa_id = e.id
   );

-- Sus niveles pierden la agenda: se re-agenda al arrancar (Epic 1, Task 1.2).
update public.niveles as n
   set fecha_seguimiento_esperada = null
 where n.etapa_id in (
   select et.id from public.etapas_tratamiento as et where et.fecha_inicio is null
 );
