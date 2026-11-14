-- Task 5.1 (inicioTratamiento, Epic 5): las 4 RPCs get_mi_*/submit_mi_evaluacion
-- que resuelven "la etapa activa del paciente caller" tratan una etapa sin
-- arrancar (fecha_inicio null) exactamente como "sin tratamiento activo".
--
-- Requisito de SEGURIDAD, no solo de calidad. Sin este gate:
--
--   * get_mi_plan_semanal: con v_fecha_inicio = NULL, fecha_desbloqueo sale
--     NULL para todas las semanas. El case de estado_semana compara
--     current_date < NULL / current_date >= NULL + 7, que dan NULL (no
--     false) → ninguna rama matchea → TODAS las semanas caen al else
--     ('actual'). El nulling de recurso_ref para semanas futuras (DEC-3-2)
--     deja de aplicar: se le expone al paciente TODO el plan de una vez
--     (fuga de datos).
--
--   * get_mi_tratamiento_activo: greatest(1, NULL) = 1 y least(NULL, 1) = 1
--     (las variádicas de Postgres ignoran nulls) → la app reporta
--     "Semana 1 de 1 total" para un tratamiento que nunca arrancó.
--
-- El caso es real, no teórico: en un reinicio de tratamiento
-- (iniciar_nueva_etapa, feat/nuevoTratamiento) el paciente YA TIENE CUENTA
-- (su OTP se emitió meses atrás, con su tratamiento anterior, y no se borra
-- al cerrar la etapa) y su etapa nueva nace SIN CONTENIDO por diseño. Puede
-- loguearse y toparse con ella en esa ventana.
--
-- Fix: se agrega `and et.fecha_inicio is not null` al where de resolución de
-- etapa activa en las 4 RPCs. Las cuatro YA tienen, inmediatamente después,
-- el gate `if not found then raise exception 'sin_etapa_activa' ... end if`.
-- Con el filtro nuevo, una etapa sin arrancar simplemente no matchea →
-- not found → se lanza sin_etapa_activa, exactamente el error que la app
-- móvil ya maneja para un paciente sin tratamiento activo. El shape del JSON
-- devuelto NO cambia, no hay campos nuevos, no hay estados nuevos: cero
-- coordinación con el repo móvil.
--
-- Se preserva en las cuatro: set search_path = '', security definer, y la
-- resolución de identidad vía public.get_mi_paciente_id() (que ya lanza
-- no_vinculado si el caller no es un paciente vinculado). No se toca nada
-- más de esas funciones.
--
-- Migración escrita a mano: `supabase db diff` está roto en este repo (issue
-- pre-existente documentado en 20260627185526_modelo_clinico_admin_stats.sql
-- y confirmado de nuevo en 20260713153000_admin_stats_sin_iniciar.sql).
-- Espejo exacto de supabase/schemas/74_rpcs_mi_paciente.sql tras el fix.
--
-- Timestamp 20260713153100 (no 20260712040600, el rango sugerido original):
-- un timestamp en 20260712_04xxxx ordena ANTES de 20260713152401, una
-- migración ya aterrizada en main — la Task 3.1 cayó exactamente en esta
-- trampa. Nada después de este timestamp en main toca get_mi_*.

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

  -- 6. semanaActual (espeja mapper L134-145): floor((hoy - inicio)/7) + 1,
  --    capeada arriba a semanasTotales. SIN clamp inferior (el mapper no tiene piso).
  v_semana_actual := least(
    floor((current_date - v_fecha_inicio)::numeric / 7)::int + 1,
    v_semanas_totales
  );

  -- 7. proximaEvaluacion (espeja mapper L181-188): min fecha futura, comparación
  --    estricta (> current_date excluye hoy, espejando getTime() > today.getTime()).
  --    Null si no queda ninguna fecha futura.
  select min(n.fecha_seguimiento_esperada)
    into v_proxima
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada > current_date;

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

comment on function public.get_mi_tratamiento_activo() is
  'Devuelve el resumen de progreso del tratamiento activo del paciente caller. '
  'Espeja mapAsignacionToPaciente.ts: nivelActual (primer nivel sin cerrar asc, o el último si todos completos), '
  'semanasTotales (cascada: ceil((maxEsperada-inicio)/7) → cantidad_sesiones → cantidad_niveles*4), '
  'semanaActual (floor((hoy-inicio)/7)+1 capeada a semanasTotales, sin piso), '
  'proximaEvaluacion (min fecha_seguimiento_esperada > current_date, comparación estricta). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo. '
  'NO devuelve etapaActual/etapasTotales.';

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
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
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
    -- Una fila por entrega_plan: deriva semana y los campos de contenido/frase.
    select
      floor(ep.dia_offset / 7)::int + 1 as semana,
      ep.orden,
      ep.dia_offset,
      ep.contenido_id,
      ep.frase_id,
      c.id           as pieza_id,
      c.tipo         as pieza_tipo,
      c.titulo       as pieza_titulo,
      c.descripcion  as pieza_descripcion,
      c.recurso_ref  as pieza_recurso_ref,
      c.duracion_seg as pieza_duracion,
      f.texto        as frase_texto
    from public.entregas_plan as ep
    left join public.contenidos as c             on c.id = ep.contenido_id
    left join public.frases_motivacionales as f  on f.id = ep.frase_id
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
      -- frase: texto plano de la única frase de la semana (no un objeto).
      -- Nuleada server-side para semanas futuras (DEC-3-2).
      'frase', case
        when m.estado_semana = 'futura' then null
        else (
          select max(b.frase_texto)
          from base as b
          where b.semana = m.semana
            and b.frase_id is not null
        )
      end
    )
    order by m.semana
  ), '[]'::jsonb)
  into v_result
  from marcadas as m;

  return v_result;
end;
$$;

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, duracion }], frase }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'Nulling de futuras: recursoRef por pieza y frase = null cuando estadoSemana = futura. '
  'recursoRef es el path del bucket (contenidos.recurso_ref), NO URL firmada — el mobile firma client-side. '
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe '
  'pero no arrancó (fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

create or replace function public.get_mi_evaluacion_vigente()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id     uuid;
  v_etapa_id        uuid;
  v_causa_id        uuid;
  v_algoritmo_id    uuid;
  v_nivel_id        uuid;
  v_numero_nivel    int;
  v_causa_frase     text;
  v_algoritmo_frase text;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + causa_id/algoritmo_id (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.causa_id, et.algoritmo_id
    into v_etapa_id, v_causa_id, v_algoritmo_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Determinar el nivel vigente: menor numero_nivel vencido sin responder.
  --    <= current_date excluye nulls legacy (la comparación con null es false).
  --    not exists sobre nivel_evaluacion garantiza que el nivel no fue respondido.
  --    order by numero_nivel asc limit 1: si hay varios vencidos, el menor primero.
  select n.id, n.numero_nivel
    into v_nivel_id, v_numero_nivel
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada <= current_date
     and not exists (
       select 1 from public.nivel_evaluacion as ne where ne.nivel_id = n.id
     )
   order by n.numero_nivel asc
   limit 1;

  if not found then
    return jsonb_build_object('vigente', false);
  end if;

  -- 4. Armar resultadoEsperado con mapeo 1:1 numero_etapa = numero_nivel.
  --    Si falta la fila de catálogo, la frase queda null (sin raise) — una
  --    fila faltante no debe tirar la pantalla de evaluación.
  select ce.frase_esperada
    into v_causa_frase
    from public.causa_etapas as ce
   where ce.causa_id = v_causa_id
     and ce.numero_etapa = v_numero_nivel;

  select ae.frase_esperada
    into v_algoritmo_frase
    from public.algoritmo_etapas as ae
   where ae.algoritmo_id = v_algoritmo_id
     and ae.numero_etapa = v_numero_nivel;

  return jsonb_build_object(
    'vigente',           true,
    'nivelId',           v_nivel_id,
    'resultadoEsperado', jsonb_build_object(
      'causa',     v_causa_frase,
      'algoritmo', v_algoritmo_frase
    )
  );
end;
$$;

comment on function public.get_mi_evaluacion_vigente() is
  'Determina el nivel vigente del paciente caller: el menor numero_nivel con '
  'fecha_seguimiento_esperada <= current_date y sin fila en nivel_evaluacion. '
  'Para ese nivel, arma las 2 frases esperadas con mapeo 1:1 numero_etapa = numero_nivel '
  'desde causa_etapas (causa_id de la etapa) y algoritmo_etapas (algoritmo_id de la etapa). '
  'Devuelve { vigente: false } si no hay nivel pendiente; '
  '{ vigente: true, nivelId, resultadoEsperado: { causa, algoritmo } } si hay uno. '
  'Frases null si falta la fila de catálogo (no interrumpe la pantalla de evaluación). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

create or replace function public.submit_mi_evaluacion(
  p_nivel_id        uuid,
  p_score_causa     int,
  p_score_algoritmo int
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id
    into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Validar scores (input barato, antes del JOIN a niveles).
  --    Ambos deben estar en [1, 5]; un solo raise cubre los dos.
  if p_score_causa not between 1 and 5
     or p_score_algoritmo not between 1 and 5 then
    raise exception 'score_invalido' using errcode = 'P0001';
  end if;

  -- 4. Verificar pertenencia del nivel a la etapa activa del caller (anti-IDOR).
  --    Un paciente no puede evaluar el nivel de otro aunque conozca su uuid.
  if not exists (
    select 1
      from public.niveles as n
     where n.id = p_nivel_id
       and n.etapa_id = v_etapa_id
  ) then
    raise exception 'nivel_ajeno' using errcode = 'P0001';
  end if;

  -- 5. Insert atómico con idempotencia vía unique_violation.
  --    (p_score_causa + p_score_algoritmo) / 2.0: el literal 2.0 (numeric)
  --    fuerza división numérica → 3 + 4 = 7 / 2.0 = 3.5, no división entera.
  --    El unique constraint nivel_id (50_nivel_evaluacion.sql:3) garantiza
  --    exactamente una evaluación por nivel — race-safe ante doble-submit.
  begin
    insert into public.nivel_evaluacion (nivel_id, score, fecha_respuesta)
    values (
      p_nivel_id,
      (p_score_causa + p_score_algoritmo) / 2.0,
      now()
    );
  exception
    when unique_violation then
      raise exception 'ya_respondida' using errcode = 'P0001';
  end;

  -- 6. Confirmar éxito.
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.submit_mi_evaluacion(uuid, int, int) is
  'RPC de escritura: recibe p_nivel_id + 2 scores 1..5 (causa y algoritmo), '
  'valida pertenencia del nivel a la etapa activa del caller (anti-IDOR), '
  'y persiste (causa+algoritmo)/2.0 en nivel_evaluacion de forma atómica e idempotente. '
  'Orden de validación: no_vinculado → sin_etapa_activa → score_invalido → nivel_ajeno → ya_respondida. '
  'Sin gate de vencido: el submit no exige fecha_seguimiento_esperada <= hoy (DEC-4-3, §16 #1). '
  'Devuelve { ok: true } al insertar con éxito. '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente vinculado; '
  'sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); '
  'score_invalido (P0001) si algún score está fuera de [1,5]; '
  'nivel_ajeno (P0001) si p_nivel_id no pertenece a la etapa activa del caller; '
  'ya_respondida (P0001) si el nivel ya tiene una evaluación registrada.';
