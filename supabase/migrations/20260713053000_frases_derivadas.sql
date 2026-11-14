-- Manual migration: `supabase db diff` is broken in this repo (bug de orden con
-- is_admin()). See supabase/schemas/44_semanas_de_etapa.sql and
-- supabase/schemas/75_rpcs_frases.sql for the declarative source of truth.

-- ---------------------------------------------------------------------------
-- semanas_de_etapa
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
  'Total de semanas de contenido de una etapa: cantidad_niveles de su modalidad × 4. Null si la etapa no existe. Fuente única de "cuánto dura un tratamiento" (DEC-0-2); la consumen etapa_plan_completo y frases_de_etapa. Privada: la invocan RPCs security definer.';

revoke execute on function public.semanas_de_etapa(uuid) from public;
revoke execute on function public.semanas_de_etapa(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- frases_de_etapa
-- ---------------------------------------------------------------------------

create or replace function public.frases_de_etapa(p_etapa_id uuid)
returns table(semana integer, orden integer, origen text, texto text)
language sql
security definer
stable
set search_path = ''
as $$
  with etapa as (
    select e.causa_id, e.algoritmo_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id
  ),
  semanas as (
    select g.k as semana
      from generate_series(1, public.semanas_de_etapa(p_etapa_id)) as g(k)
  )
  select s.semana, 1 as orden, 'causa'::text as origen, cf1.texto
    from semanas as s
    cross join etapa as et
    join public.causa_frases as cf1
      on cf1.causa_id = et.causa_id
     and cf1.orden = 2 * s.semana - 1
  union all
  select s.semana, 2 as orden, 'algoritmo'::text as origen, af.texto
    from semanas as s
    cross join etapa as et
    join public.algoritmo_frases as af
      on af.algoritmo_id = et.algoritmo_id
     and af.orden = s.semana
  union all
  select s.semana, 3 as orden, 'causa'::text as origen, cf2.texto
    from semanas as s
    cross join etapa as et
    join public.causa_frases as cf2
      on cf2.causa_id = et.causa_id
     and cf2.orden = 2 * s.semana
  order by semana, orden;
$$;

comment on function public.frases_de_etapa(uuid) is
  'Deriva las 3 frases motivacionales de cada semana de una etapa: [causa#(2k-1), algoritmo#k, causa#(2k)] para la semana k. Relación (semana, orden, origen, texto); joins inner contra causa_frases/algoritmo_frases (guard de run-out: sin filas para una semana que exceda el catálogo). Etapa inexistente devuelve relación vacía. Privada: la invoca get_frases_del_tratamiento_activo.';

revoke execute on function public.frases_de_etapa(uuid) from public;
revoke execute on function public.frases_de_etapa(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- get_frases_del_tratamiento_activo
-- ---------------------------------------------------------------------------

create or replace function public.get_frases_del_tratamiento_activo(p_paciente_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
  v_etapa_id     uuid;
  v_result       jsonb;
begin
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and v_terapeuta_id = auth.uid())
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select et.id into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if v_etapa_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana', semanas.semana,
      'frases', semanas.frases
    )
    order by semanas.semana
  ), '[]'::jsonb)
  into v_result
  from (
    select f.semana,
           jsonb_agg(
             jsonb_build_object(
               'orden',  f.orden,
               'origen', f.origen,
               'texto',  f.texto
             )
             order by f.orden
           ) as frases
      from public.frases_de_etapa(v_etapa_id) as f
     group by f.semana
  ) as semanas;

  return v_result;
end;
$$;

comment on function public.get_frases_del_tratamiento_activo(uuid) is
  'Devuelve las frases motivacionales derivadas del tratamiento activo de un paciente, agrupadas por semana ([{ semana, frases: [{ orden, origen, texto }] }]). Paciente sin etapa activa -> []. Acceso: el terapeuta asignado al paciente (asignación activa) o un admin, con comparación NULL-safe.';

grant execute on function public.get_frases_del_tratamiento_activo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- etapa_plan_completo: pasa a consumir semanas_de_etapa() (DEC-0-2) en vez de
-- calcular cantidad_niveles * 4 inline. Solo el cálculo de v_total cambia; el
-- resto del cuerpo (conteo de semanas completas por los 3 slots) es idéntico.
-- ---------------------------------------------------------------------------

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
  v_total := public.semanas_de_etapa(p_etapa_id);

  if v_total is null then
    return false;
  end if;

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
