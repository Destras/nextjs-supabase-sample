-- =====================================================================
-- get_mi_plan_semanal: frases derivadas (frases_de_etapa) reemplazan la
-- lectura de entregas_plan.frase_id / frases_motivacionales —
-- frasesAutomaticas Task 2.2
-- =====================================================================
-- El segundo fallo silencioso del feature. Este RPC leía entregas_plan.frase_id
-- + frases_motivacionales para armar el campo escalar `frase` de cada semana.
-- Desde Task 2.1 (baja de 3 a 2 slots), set_entregas_plan ya no persiste una
-- fila de orden 3 (frase) — así que frase_id nunca vuelve a poblarse y este
-- RPC devolvería frase: null para siempre, en todas las semanas y para todos
-- los pacientes, sin lanzar ningún error. La app seguiría mostrando el video
-- y el mantra; las 1376 frases del catálogo (causa_frases + algoritmo_frases,
-- Task 0.1/0.2) quedarían enterradas sin que nadie las lea.
--
-- Se redefine para derivar las frases invocando public.frases_de_etapa(v_etapa_id)
-- (Task 0.3, epic-0) — función privada, security definer, que este RPC puede
-- invocar porque también corre como definer. La lista de semanas SIGUE
-- saliendo de entregas_plan (DEC-2-1, sin cambios): frases_de_etapa solo
-- aporta el contenido de cada semana ya existente, nunca agrega semanas
-- nuevas al array de salida (el join final es left join marcadas → frases_por_semana).
--
-- Contrato: la clave `frase` (escalar) desaparece; se reemplaza por `frases`,
-- un array de hasta 3 objetos { orden, origen, texto } ordenados por orden,
-- coalesced a [] cuando la semana no tiene frases derivadas (run-out del
-- catálogo, hoy imposible) o cuando estadoSemana = 'futura' (DEC-2-2, misma
-- nulling que ya aplica a recursoRef). Sin período de compatibilidad: la app
-- mobile (repo aparte) no está en producción.
--
-- Orden de la migración: esta task va ANTES de Task 4.1 (drop column
-- entregas_plan.frase_id) a propósito — si Task 4.1 corriera primero, esta
-- función seguiría referenciando la columna y el drop fallaría por
-- dependencia. Ese orden es la red de seguridad real de este cambio.
--
-- create or replace: misma firma () returns jsonb, mismo security definer /
-- stable / search_path / grant a authenticated — sin cambios de permisos.
-- =====================================================================

create or replace function public.get_mi_plan_semanal()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_fecha_inicio date;
  v_result      jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    No se necesita la modalidad: las semanas salen de las entregas_plan realmente
  --    cargadas (el plan se autoriza completo antes de generar el OTP).
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Armar el array de semanas en un único query con CTEs (DEC-3-1…DEC-3-4).
  --    Una fila de salida por SEMANA (no por entrega): fechaDesbloqueo es el
  --    inicio de la semana (fecha_inicio + (semana-1)*7), robusto a entregas en
  --    días distintos dentro de la misma semana (evita semanas duplicadas).
  with base as (
    -- Una fila por entrega_plan: deriva semana y los campos de contenido.
    -- La frase ya NO sale de acá (Task 2.2): frase_id/frases_motivacionales
    -- fueron retirados de esta CTE; la lista de semanas sigue viniendo de
    -- entregas_plan (DEC-2-1), pero su contenido de frases se resuelve más
    -- abajo con la CTE frases_por_semana.
    select
      floor(ep.dia_offset / 7)::int + 1 as semana,
      ep.orden,
      ep.dia_offset,
      ep.contenido_id,
      c.id           as pieza_id,
      c.tipo         as pieza_tipo,
      c.titulo       as pieza_titulo,
      c.descripcion  as pieza_descripcion,
      c.recurso_ref  as pieza_recurso_ref,
      c.duracion_seg as pieza_duracion
    from public.entregas_plan as ep
    left join public.contenidos as c on c.id = ep.contenido_id
    where ep.etapa_id = v_etapa_id
  ),
  semanas as (
    -- Una fila por semana distinta; fecha_desbloqueo = inicio de la semana.
    select
      b.semana,
      (v_fecha_inicio + (b.semana - 1) * 7)::date as fecha_desbloqueo
    from base as b
    group by b.semana
  ),
  marcadas as (
    -- estadoSemana por semana. Ventana semiabierta [desbloqueo, desbloqueo+7).
    select
      s.semana,
      s.fecha_desbloqueo,
      case
        when current_date <  s.fecha_desbloqueo     then 'futura'
        when current_date >= s.fecha_desbloqueo + 7 then 'anterior'
        else 'actual'
      end as estado_semana
    from semanas as s
  ),
  frases_por_semana as (
    -- Frases derivadas de la etapa (Task 0.3, epic-0): 3 objetos por semana
    -- ya ordenados por orden. Joineada por semana contra `marcadas`, nunca
    -- agrega semanas nuevas (frases_de_etapa puede cubrir más semanas que
    -- las que tienen media cargada; el join en el select final filtra eso).
    select
      f.semana,
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
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana',          m.semana,
      'estadoSemana',    m.estado_semana,
      'fechaDesbloqueo', m.fecha_desbloqueo,
      -- piezas: filas de media (contenido_id not null) de la semana, ordenadas
      -- por (orden, dia_offset). recursoRef nuleado server-side para futuras.
      -- Semana sin media devuelve piezas: [] (coalesce).
      'piezas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',          b.pieza_id,
            'tipo',        b.pieza_tipo,
            'titulo',      b.pieza_titulo,
            'descripcion', b.pieza_descripcion,
            'recursoRef',  case when m.estado_semana = 'futura' then null else b.pieza_recurso_ref end,
            'duracion',    b.pieza_duracion
          )
          order by b.orden, b.dia_offset
        )
        from base as b
        where b.semana = m.semana
          and b.contenido_id is not null
      ), '[]'::jsonb),
      -- frases: los 3 objetos { orden, origen, texto } derivados de
      -- frases_de_etapa para esta semana, ya ordenados por orden. Nuleada
      -- (vaciada) server-side para semanas futuras (DEC-2-2, misma regla que
      -- ya se aplica a recursoRef). Sin fila en frases_por_semana (run-out
      -- del catálogo) → [] via coalesce, nunca null.
      'frases', case
        when m.estado_semana = 'futura' then '[]'::jsonb
        else coalesce(fps.frases, '[]'::jsonb)
      end
    )
    order by m.semana
  ), '[]'::jsonb)
  into v_result
  from marcadas as m
  left join frases_por_semana as fps on fps.semana = m.semana;

  return v_result;
end;
$$;

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, duracion }], frases: [{ orden, origen, texto }] }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'La lista de semanas sigue viniendo de entregas_plan (una semana existe si tiene media cargada); '
  'frases se deriva invocando public.frases_de_etapa(v_etapa_id) (Task 0.3) y se joinea por semana, '
  'nunca agrega semanas nuevas. frases trae hasta 3 objetos ordenados por orden; [] si la semana no tiene '
  'frases derivadas (run-out del catálogo) o si es futura (DEC-2-2, misma nulling que recursoRef). '
  'El campo escalar frase (deprecado) NO existe en este contrato: no se lee entregas_plan.frase_id ni frases_motivacionales. '
  'Nulling de futuras: recursoRef por pieza = null y frases = [] cuando estadoSemana = futura. '
  'recursoRef es el path del bucket (contenidos.recurso_ref), NO URL firmada — el mobile firma client-side. '
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa; no_vinculado (P0001) si no hay vínculo.';
