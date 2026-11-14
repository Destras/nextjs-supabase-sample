-- ---------------------------------------------------------------------------
-- RECONCILIACIÓN — frasesAutomaticas ⨯ inicioTratamiento
-- ---------------------------------------------------------------------------
-- Las dos ramas hicieron `create or replace` sobre las MISMAS DOS funciones, en
-- migraciones distintas. Las migraciones son SNAPSHOTS IMPERATIVOS: la última que
-- corre pisa el cuerpo ENTERO de la anterior. Las de frasesAutomaticas tienen
-- timestamp posterior, así que pisaban a las de inicioTratamiento con un cuerpo
-- escrito sobre un `main` donde su trabajo todavía no existía.
--
-- Lo que se perdía, y NINGUNO de los dos hacía ruido:
--
--   1. set_entregas_plan  → se perdía EL ARRANQUE del tratamiento
--      (fecha_inicio, estado 'activa', recompute de niveles). Resultado: ningún
--      paciente arrancaba y ninguno recibía su OTP. Silencioso.
--
--   2. get_mi_plan_semanal → se perdía el gate `fecha_inicio is not null`.
--      Sin él, con fecha_inicio NULL las comparaciones de estado_semana dan NULL,
--      todas las semanas caen al else y quedan 'actual' → no se aplica el nulling
--      de recurso_ref y SE LE EXPONE AL PACIENTE EL PLAN COMPLETO DE UNA VEZ.
--
-- Esta migración es la foto DEFINITIVA de las dos funciones: el cuerpo COMBINADO,
-- copiado literal de supabase/schemas/ (la fuente de verdad) tras resolver el merge.
--
-- ⚠️ Escrita A MANO: `supabase db diff` está roto en este repo (bug de orden
-- preexistente — is_admin() se usa en 11_profiles.sql antes de definirse en
-- 25_admin_functions.sql). Es la excepción declarada; hay ~20 migraciones así.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- set_entregas_plan — EL ARRANQUE (inicioTratamiento) + SIN FRASES (frasesAutomaticas)
-- ---------------------------------------------------------------------------
-- El plan completo son 2 slots (video + mantra), no 3: la frase dejó de ser una
-- entrega asignable. Cuando etapa_plan_completo() da true, ARRANCA el tratamiento.
-- ---------------------------------------------------------------------------

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id  uuid;
  v_paciente_id   uuid;
  v_estado_activa uuid;
  v_arrancada     integer;
begin
  -- 1. Resolver la etapa y obtener el terapeuta dueño.
  select e.terapeuta_id into v_terapeuta_id
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  if not (public.is_admin() or auth.uid() = v_terapeuta_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  delete from public.entregas_plan
   where etapa_id = p_etapa_id;

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item;
  -- contenido_id not null valida cada fila; un item sin contenido_id
  -- aborta la transacción entera.

  -- 4. Si el plan quedó completo para todas las semanas (DEC-E1-2), devolver el
  --    paciente_id para que el web console dispare la emisión+entrega del OTP de
  --    activación vía la Edge Function paciente-invitacion. La emisión ya NO ocurre
  --    acá: Postgres no puede llamar a la Meta Cloud API y el plaintext del OTP debe
  --    entregarse por WhatsApp desde un boundary de Edge Function (DevSpec §9.2).
  --    La idempotencia (no duplicar OTP) la garantiza generar_otp_activacion en la EF.
  if public.etapa_plan_completo(p_etapa_id) then
    -- 1. Arranque: idempotente (fecha_inicio is null) e irreversible.
    --    fecha_finalizacion is null: NO se resucita una etapa cerrada (DEC-E1-2).
    select ee.id into v_estado_activa
      from public.estados_etapa as ee
     where ee.codigo = 'activa';

    update public.etapas_tratamiento
       set fecha_inicio = current_date,
           estado_id    = v_estado_activa
     where id = p_etapa_id
       and fecha_inicio is null
       and fecha_finalizacion is null;

    get diagnostics v_arrancada = row_count;

    -- 2. Recompute de la agenda: SOLO si arrancó recién (DEC-4).
    if v_arrancada = 1 then
      update public.niveles as n
         set fecha_seguimiento_esperada =
               (current_date + (n.numero_nivel * interval '1 month'))::date
       where n.etapa_id = p_etapa_id;
    end if;

    -- 3. Devolver el paciente_id (comportamiento EXISTENTE, no se toca — DEC-E1-1).
    select e.paciente_id into v_paciente_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id;

    return v_paciente_id;
  end if;

  return null;
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 2 slots persistibles: video + mantra — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = current_date, estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion) — el reintento del OTP depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- get_mi_plan_semanal — EL GATE (inicioTratamiento) + LAS FRASES DERIVADAS (frasesAutomaticas)
-- ---------------------------------------------------------------------------
-- El gate `et.fecha_inicio is not null` NO es cosmético: una etapa sin arrancar
-- NO es un tratamiento activo. Sin él se filtra el plan entero al paciente.
-- ---------------------------------------------------------------------------

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
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe '
  'pero no arrancó (fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

grant execute on function public.get_mi_plan_semanal() to authenticated;
