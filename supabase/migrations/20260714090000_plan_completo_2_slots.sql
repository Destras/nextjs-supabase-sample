-- =====================================================================
-- etapa_plan_completo: baja de 3 slots (video/mantra/frase) a 2
-- (video/mantra) — frasesAutomaticas Task 2.1
-- =====================================================================
-- La frase (antiguo orden 3) dejó de ser un slot que el terapeuta llena vía
-- set_entregas_plan: ahora es derivada/automática (frases_de_etapa,
-- Epic 1 de frasesAutomaticas) y ya no se persiste como fila de
-- entregas_plan. El front ya bajó su propio invariante a 2 slots
-- (isSemanaCompleta en semanaCompleteness.ts + SLOT_DEFINITIONS en
-- slotDefinitions.ts, Task 1.1) — este RPC quedaba exigiendo 3 órdenes
-- distintos por semana, y como nadie vuelve a escribir la fila de orden 3,
-- el plan NUNCA se marca completo: set_entregas_plan nunca dispara el
-- paciente_id de retorno, el web console nunca invoca la emisión del OTP, y
-- ningún paciente nuevo entra a la app. No lanza ningún error: falla en
-- silencio. Se redefine para espejar al front exactamente.
--
-- Convivencia con planes viejos: filas de orden = 3 que sobrevivan de un
-- plan cargado antes de este cambio se ignoran (el filtro pasa a
-- `orden in (1, 2)`); no rompen ni aportan a la cuenta. Esto permite mergear
-- esta migración antes de que Task 4.1 (epic-4) limpie esas filas.
--
-- create or replace: misma firma (uuid) returns boolean, mismo
-- security definer / search_path / revoke-from-public — sin cambios de
-- permisos.
-- =====================================================================

create or replace function public.etapa_plan_completo(p_etapa_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total     integer;
  v_completas integer;
begin
  -- Total de semanas de contenido = cantidad_niveles * 4 (4 meses × 4 semanas).
  -- Fuente única (DEC-0-2): semanas_de_etapa, que también consume
  -- frases_de_etapa. cantidad_sesiones (16/32) es metadata clínica del equipo
  -- del equipo terapéutico, NO define las semanas de contenido.
  v_total := public.semanas_de_etapa(p_etapa_id);

  if v_total is null then
    return false;
  end if;

  -- Una semana (dia_offset / 7) está completa si tiene las 2 entregas
  -- persistibles: orden 1 (video) y orden 2 (mantra) — el mismo invariante de
  -- 2 slots que enforce el front (isSemanaCompleta en semanaCompleteness.ts).
  -- orden = 3 (frase) quedó fuera del contrato de set_entregas_plan: la frase
  -- es derivada/automática, no un slot que el terapeuta llene. Filtramos a
  -- (1, 2) explícitamente para que filas de orden 3 que sobrevivan de planes
  -- viejos (convivencia — Task 4.1 las limpia después) ni cuenten a favor ni
  -- rompan la cuenta.
  select count(*)
    into v_completas
    from (
      select ep.dia_offset / 7 as semana
        from public.entregas_plan as ep
       where ep.etapa_id = p_etapa_id
         and ep.orden in (1, 2)
       group by ep.dia_offset / 7
      having count(distinct ep.orden) = 2
    ) as t;

  return v_completas = v_total;
end;
$$;

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (semanas_de_etapa) tienen los 2 slots persistibles (órdenes 1=video, 2=mantra). La frase (antiguo orden 3) es derivada/automática y no participa de la completitud. Espeja la regla de completitud del front (isSemanaCompleta en semanaCompleteness.ts, Task 1.1). Privada: la invoca set_entregas_plan.';

revoke execute on function public.etapa_plan_completo(uuid) from public;
