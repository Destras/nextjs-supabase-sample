-- ---------------------------------------------------------------------------
-- semanas_de_etapa
-- ---------------------------------------------------------------------------
-- Total de semanas de contenido de una etapa de tratamiento: cantidad_niveles
-- de la modalidad × 4 (4 meses × 4 semanas). Fuente única de "cuánto dura un
-- tratamiento" (DEC-0-2): antes vivía inline dentro de etapa_plan_completo
-- (eliminada en planBorrador: el plan ya no tiene noción de "completo") y hoy
-- la consume frases_de_etapa (75_rpcs_frases.sql). Extraerla acá evita que la
-- regla quede escrita dos veces y pueda divergir.
--
-- Devuelve null si la etapa no existe (no lanza): los callers (generate_series
-- en frases_de_etapa) ya saben tratar null como "no hay nada que derivar".
--
-- security definer: corre como owner porque etapas_tratamiento/modalidades
-- tienen RLS terapeuta-only; el helper debe poder resolver la cuenta sin
-- depender de si el caller (definer de más arriba) tiene acceso propio.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
--
-- Privada: sin grant a roles externos. Revoca de public Y de authenticated
-- (no solo public): este proyecto tiene un `alter default privileges ...
-- grant execute to authenticated` global (ver derive_alertas_activas en
-- 65_alertas.sql) que de otro modo dejaría a cualquier terapeuta invocar el
-- helper directo — no tiene authz propia, así que no puede quedar expuesto.
-- La invoca frases_de_etapa, security definer.
--
-- Este archivo va en 44_ a propósito: después de 12_modalidades,
-- 31_etapas_tratamiento y 43_entregas_plan, y antes de 71_rpcs_pacientes
-- (que la consume). El orden lexicográfico = orden de ejecución; este repo
-- tuvo supabase db diff roto por un helper usado antes de definirse
-- (is_admin() en 11_profiles.sql antes de 25_admin_functions.sql, fijado en
-- fix/schema-load-order: is_admin ahora vive en 15_identity_functions.sql) —
-- no repetimos el patrón.
-- ---------------------------------------------------------------------------

create or replace function public.semanas_de_etapa(p_etapa_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select m.cantidad_niveles * 4
    from public.etapas_tratamiento as e
    join public.modalidades as m on m.id = e.modalidad_id
   where e.id = p_etapa_id;
$$;

comment on function public.semanas_de_etapa(uuid) is
  'Total de semanas de contenido de una etapa: cantidad_niveles de su modalidad × 4. Null si la etapa no existe. Fuente única de "cuánto dura un tratamiento" (DEC-0-2); la consume frases_de_etapa. Privada: la invoca un RPC security definer.';

-- Sin grant: privada (la llama frases_de_etapa, que
-- corre como definer). anon y authenticated no necesitan acceso directo.
-- Revoca de ambos: `from public` no alcanza por el default privilege global.
revoke execute on function public.semanas_de_etapa(uuid) from public, anon, authenticated;
