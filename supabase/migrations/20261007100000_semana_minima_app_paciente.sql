-- =============================================================================
-- pulidoBeta / BETA-042 — la app del paciente nunca recibe "semana 0"
-- =============================================================================
-- get_mi_tratamiento_activo calculaba semanaActual con tope superior y sin piso:
-- con una fecha_inicio posterior a public.hoy() devolvía 0 (o negativa). Esas
-- filas existen: las guardadas con el día UTC antes de BETA-031 (ADR 0012)
-- quedaron un día adelantadas entre las 21:00 y las 24:00 de Argentina.
--
-- Se recrea la función con greatest(1, …) en semanaActual. Nada más cambia: misma
-- firma, security definer, stable, search_path = '', mismas 7 claves del jsonb.
-- Para toda fecha_inicio <= hoy el resultado es idéntico al anterior.
--
-- No se tocan get_mi_plan_semanal ni public.entrega_liberada: con una
-- fecha_inicio futura siguen marcando la semana 1 como 'futura' un día, porque
-- esa regla es la misma que usa la policy de lectura de Storage (SEG-002).
--
-- create or replace conserva los privilegios de la función (SEG-005); el grant
-- se repite igual, como en el schema declarativo. Sin migración de datos.
-- =============================================================================

create or replace function public.get_mi_tratamiento_activo()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id       uuid;
  v_etapa_id          uuid;
  v_fecha_inicio      date;
  v_cantidad_niveles  int;
  v_cantidad_sesiones int;
  v_nivel_actual      int;
  v_max_esperada      date;
  v_semanas_totales   int;
  v_semana_actual     int;
  v_proxima           date;
  v_estado            text;
  v_result            jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + modalidad (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.fecha_inicio, m.cantidad_niveles, m.cantidad_sesiones
    into v_etapa_id, v_fecha_inicio, v_cantidad_niveles, v_cantidad_sesiones
    from public.etapas_tratamiento as et
    join public.modalidades as m on m.id = et.modalidad_id
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. nivelActual (espeja mapper L89-97): primer nivel sin cerrar (asc), o el
  --    último si todos cerrados. Single-pass con coalesce + aggregate filter.
  --    Sin niveles → coalesce(null, null) = null.
  select coalesce(
    min(n.numero_nivel) filter (where n.fecha_seguimiento_real is null),
    max(n.numero_nivel)
  )
    into v_nivel_actual
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 4. v_max_esperada: insumo de semanasTotales (espeja lastFechaSeguimientoEsperada L101-106).
  --    max() ignora nulls de forma nativa.
  select max(n.fecha_seguimiento_esperada)
    into v_max_esperada
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 5. semanasTotales (espeja mapper L117-132, cuidado PAC-005).
  --    Rama agendada: ceil((max_esperada - fecha_inicio) / 7) con greatest(1, ...).
  --    Fallback: coalesce(cantidad_sesiones, cantidad_niveles*4).
  --    NUNCA *4 a secas (eso es el bug PAC-005: daba 16 para toda modalidad con 4 niveles).
  v_semanas_totales := case
    when v_max_esperada is not null
      then greatest(1, ceil((v_max_esperada - v_fecha_inicio)::numeric / 7))::int
    else coalesce(v_cantidad_sesiones, v_cantidad_niveles * 4)
  end;

  -- 6. semanaActual (espeja semanaActual.ts del panel): floor((hoy - inicio)/7) + 1,
  --    capeada arriba a semanasTotales y con piso de 1 (BETA-042). El piso cubre
  --    una fecha_inicio posterior a hoy: las filas guardadas con el día UTC antes
  --    de BETA-031 quedaron un día adelantadas y daban semana 0. semanasTotales
  --    siempre es >= 1 en la rama agendada; el greatest va por fuera para que el
  --    piso valga también si el fallback de la modalidad fuera menor.
  v_semana_actual := greatest(
    1,
    least(
      floor((public.hoy() - v_fecha_inicio)::numeric / 7)::int + 1,
      v_semanas_totales
    )
  );

  -- 7. proximaEvaluacion (espeja mapper L181-188): min fecha futura, comparación
  --    estricta (> public.hoy() excluye hoy, espejando getTime() > today.getTime()).
  --    Null si no queda ninguna fecha futura.
  select min(n.fecha_seguimiento_esperada)
    into v_proxima
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada > public.hoy();

  -- 8. estado: código del estado del paciente (no de la etapa).
  --    Misma fuente que get_mi_perfil; null si paciente no tiene estado asignado.
  select ep.codigo
    into v_estado
    from public.pacientes as p
    left join public.estados_paciente as ep on ep.id = p.estado_id
   where p.id = v_paciente_id;

  -- 9. Armar y devolver el jsonb con las 7 claves del contrato (D-3).
  --    NO se incluyen etapaActual/etapasTotales.
  v_result := jsonb_build_object(
    'nivelActual',       v_nivel_actual,
    'nivelesTotales',    v_cantidad_niveles,
    'semanaActual',      v_semana_actual,
    'semanasTotales',    v_semanas_totales,
    'fechaInicio',       v_fecha_inicio,
    'proximaEvaluacion', v_proxima,
    'estado',            v_estado
  );
  return v_result;
end;
$$;

grant execute on function public.get_mi_tratamiento_activo() to authenticated;

comment on function public.get_mi_tratamiento_activo() is
  'Devuelve el resumen de progreso del tratamiento activo del paciente caller. '
  'Espeja mapAsignacionToPaciente.ts: nivelActual (primer nivel sin cerrar asc, o el último si todos completos), '
  'semanasTotales (cascada: ceil((maxEsperada-inicio)/7) → cantidad_sesiones → cantidad_niveles*4), '
  'semanaActual (floor((hoy-inicio)/7)+1 capeada a semanasTotales, con piso de 1), '
  'proximaEvaluacion (min fecha_seguimiento_esperada > public.hoy(), comparación estricta). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo. '
  'NO devuelve etapaActual/etapasTotales.';
