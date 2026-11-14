-- =====================================================================
-- etapa_plan_completo: total de semanas = cantidad_niveles * 4 (no sesiones)
-- =====================================================================
-- El modelo clínico (modeloClinico v2) fija las semanas de contenido en
-- cantidad_niveles * 4 (= 16), independientes de cantidad_sesiones (16/32),
-- que es metadata clínica del equipo terapéutico. El front ya deriva así
-- (semanasDeTratamiento); este RPC quedaba con la regla vieja
-- coalesce(cantidad_sesiones, cantidad_niveles*4), por lo que para modalidades
-- de 32 sesiones exigía 32 semanas mientras el front sólo arma 16 → el plan
-- nunca se marcaba completo y no se disparaba generar_otp_activacion. Se
-- redefine para espejar al front. (create or replace; misma firma/permisos.)
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
  -- Fuente única, espeja al front (semanasDeTratamiento). cantidad_sesiones (16/32)
  -- es metadata clínica del equipo terapéutico, NO define las semanas de contenido.
  select m.cantidad_niveles * 4
    into v_total
    from public.etapas_tratamiento as e
    join public.modalidades as m on m.id = e.modalidad_id
   where e.id = p_etapa_id;

  if v_total is null then
    return false;
  end if;

  -- Una semana (dia_offset / 7) está completa si tiene las 3 entregas:
  -- orden 1 (video), 2 (audio) y 3 (frase) — el mismo invariante de 3 slots
  -- que enforce el front (isSemanaCompleta en semanaCompleteness.ts).
  select count(*)
    into v_completas
    from (
      select ep.dia_offset / 7 as semana
        from public.entregas_plan as ep
       where ep.etapa_id = p_etapa_id
         and ep.orden in (1, 2, 3)
       group by ep.dia_offset / 7
      having count(distinct ep.orden) = 3
    ) as t;

  return v_completas = v_total;
end;
$$;

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (cantidad_niveles*4) tienen los 3 slots (órdenes 1, 2, 3). Espeja la regla de completitud del front (semanasDeTratamiento). Privada: la invoca set_entregas_plan.';

revoke execute on function public.etapa_plan_completo(uuid) from public;
