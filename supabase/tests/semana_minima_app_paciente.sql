-- =============================================================================
-- semana_minima_app_paciente.sql — Assertion tests for pulidoBeta / BETA-042
-- =============================================================================
-- Coverage: la app del paciente nunca recibe una semana menor que 1.
--   BLOCK 1 — get_mi_tratamiento_activo().semanaActual con
--             fecha_inicio = public.hoy() + 1  → 1 (antes: 0)
--             fecha_inicio = public.hoy()      → 1
--             fecha_inicio = public.hoy() - 7  → 2 (igual que antes)
--             fecha_inicio = public.hoy() - 8  → 2, y el resto del contrato
--             conserva sus 7 claves.
--
-- Una fecha_inicio posterior a hoy no debería existir, pero existe: las filas
-- guardadas con el día UTC antes de BETA-031 (ADR 0012) quedaron un día
-- adelantadas entre las 21:00 y las 24:00 de Argentina.
--
-- TOOLING (mirrors supabase/tests/hoy_dia_local.sql — no pgTAP): bloque
-- DO $$ ... ASSERT ... $$ dentro de begin/rollback. Un assert que falla aborta
-- el script con ERROR; el bloque que pasa imprime "BLOCK 1 PASSED".
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/semana_minima_app_paciente.sql
--   (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- PREREQUISITES: schema aplicado (incluida 20261007100000) + un paciente con
-- cuenta (user_id) y un tratamiento en curso, como los cuatro del seed. Nada
-- queda escrito: todo corre dentro de una transacción que se revierte.
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================

begin;

-- Las fechas se mueven a mano: sin triggers que recalculen niveles ni updated_at.
set local session_replication_role = replica;

do $$
declare
  v_user_id  uuid;
  v_etapa_id uuid;
  v_res      jsonb;
begin
  raise notice '--- BLOCK 1: semanaActual nunca es menor que 1 ---';

  select p.user_id, e.id
    into v_user_id, v_etapa_id
    from public.pacientes as p
    join public.etapas_tratamiento as e on e.paciente_id = p.id
   where p.user_id is not null
     and e.fecha_finalizacion is null
     and e.fecha_inicio is not null
   order by p.id
   limit 1;

  assert v_user_id is not null,
    'BLOCK 1: hace falta un paciente con cuenta y tratamiento en curso (seed)';

  -- La última evaluación queda lejos: semanasTotales no capea las semanas 1 y 2.
  update public.niveles
     set fecha_seguimiento_esperada = public.hoy() + 28 * numero_nivel
   where etapa_id = v_etapa_id;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  update public.etapas_tratamiento set fecha_inicio = public.hoy() + 1 where id = v_etapa_id;
  v_res := public.get_mi_tratamiento_activo();
  assert (v_res ->> 'semanaActual')::int = 1,
    format('BLOCK 1: fecha_inicio = hoy + 1 debe dar semana 1, dio %s', v_res ->> 'semanaActual');

  update public.etapas_tratamiento set fecha_inicio = public.hoy() where id = v_etapa_id;
  v_res := public.get_mi_tratamiento_activo();
  assert (v_res ->> 'semanaActual')::int = 1,
    format('BLOCK 1: fecha_inicio = hoy debe dar semana 1, dio %s', v_res ->> 'semanaActual');

  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 7 where id = v_etapa_id;
  v_res := public.get_mi_tratamiento_activo();
  assert (v_res ->> 'semanaActual')::int = 2,
    format('BLOCK 1: fecha_inicio = hoy - 7 debe dar semana 2, dio %s', v_res ->> 'semanaActual');

  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 8 where id = v_etapa_id;
  v_res := public.get_mi_tratamiento_activo();
  assert (v_res ->> 'semanaActual')::int = 2,
    format('BLOCK 1: fecha_inicio = hoy - 8 debe dar semana 2, dio %s', v_res ->> 'semanaActual');

  assert (select array_agg(k order by k) from jsonb_object_keys(v_res) as k)
       = array['estado', 'fechaInicio', 'nivelActual', 'nivelesTotales',
               'proximaEvaluacion', 'semanaActual', 'semanasTotales'],
    'BLOCK 1: el contrato de get_mi_tratamiento_activo conserva sus 7 claves';

  raise notice 'BLOCK 1 PASSED';
end;
$$;

rollback;
