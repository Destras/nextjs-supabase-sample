-- ---------------------------------------------------------------------------
-- RPCs del paciente — seam de identidad + endpoints mobile
-- ---------------------------------------------------------------------------
-- Este archivo declara el helper privado de identidad y los 6 RPCs que expone
-- la app mobile del paciente (se agregan en Epics 1–4 + medicionEvolutiva):
--
--   get_mi_paciente_id()          ← helper privado (esta task, 0.2)
--   get_mi_perfil()               ← Epic 1
--   get_mi_tratamiento_activo()   ← Epic 2
--   get_mi_plan_semanal()         ← Epic 3
--   get_mi_evaluacion_vigente()   ← Epic 4
--   submit_mi_evaluacion()        ← Epic 4
--   get_mi_estructura_actual()    ← medicionEvolutiva
--
-- Todos los RPCs son security definer + set search_path = '' (DEC-0-2).
-- El helper no recibe parámetros de identidad: resuelve auth.uid() internamente
-- para que sea imposible que un paciente pida datos de otro (DEC-0-1).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- get_mi_paciente_id
-- ---------------------------------------------------------------------------
-- Resuelve auth.uid() → id del paciente vinculado.
-- Si el caller no tiene un paciente asociado, lanza 'no_vinculado' (P0001).
--
-- security definer: corre como owner (postgres) porque public.pacientes tiene
-- RLS terapeuta-only; el paciente no puede hacer select de su propia fila.
-- stable: no modifica datos; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
--
-- Privada: sin grant a authenticated. Los RPCs get_mi_*/submit_mi_evaluacion
-- son security definer (corren como owner) y pueden invocar este helper;
-- el paciente nunca puede llamarlo directamente (DEC-0-2).
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_paciente_id()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
begin
  select id
    into v_paciente_id
    from public.pacientes
   where user_id = auth.uid();

  if not found or v_paciente_id is null then
    raise exception 'no_vinculado' using errcode = 'P0001';
  end if;

  return v_paciente_id;
end;
$$;

comment on function public.get_mi_paciente_id() is
  'Resuelve auth.uid() al id del paciente vinculado en public.pacientes. '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente asociado. '
  'Privada (sin grant a authenticated): la invocan los RPCs get_mi_*/submit_mi_evaluacion, '
  'que corren como security definer y tienen acceso como owner.';

-- Sin grant: privada (la llaman los RPCs de paciente, que corren como definer).
-- anon y authenticated no necesitan —ni deben tener— acceso directo.
revoke execute on function public.get_mi_paciente_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_mi_perfil
-- ---------------------------------------------------------------------------
-- Devuelve la proyección segura del perfil del paciente caller.
-- Resuelve la identidad vía get_mi_paciente_id() y arma un jsonb con los 9
-- campos de contacto visibles al paciente: nombre, telefono, email,
-- contactoAlternativo, relacionContacto, fechaNacimiento, fechaAlta, edad
-- (derivada de fecha_nacimiento) y estado (derivado de estados_paciente.codigo).
--
-- security definer: corre como owner porque public.pacientes tiene RLS
-- terapeuta-only; el paciente no puede hacer select de su propia fila.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_perfil()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_result      jsonb;
begin
  v_paciente_id := public.get_mi_paciente_id();

  select jsonb_build_object(
    'nombre',              p.nombre,
    'telefono',            p.telefono,
    'email',               p.email,
    'contactoAlternativo', p.contacto_alternativo,
    'relacionContacto',    p.relacion_contacto,
    'fechaNacimiento',     p.fecha_nacimiento,
    'fechaAlta',           p.fecha_alta,
    'edad',                case when p.fecha_nacimiento is null then null
                                else extract(year from age(p.fecha_nacimiento))::int end,
    'estado',              ep.codigo
  )
  into v_result
  from public.pacientes as p
  left join public.estados_paciente as ep on ep.id = p.estado_id
  where p.id = v_paciente_id;

  return v_result;
end;
$$;

grant execute on function public.get_mi_perfil() to authenticated;

comment on function public.get_mi_perfil() is
  'Devuelve la proyección segura del perfil del paciente caller resuelto por auth.uid(). '
  'Retorna un jsonb con 9 claves camelCase (nombre, telefono, email, contactoAlternativo, '
  'relacionContacto, fechaNacimiento, fechaAlta, edad, estado). '
  'edad se deriva de fecha_nacimiento (años completos, null si ausente). '
  'estado se deriva de estados_paciente.codigo (activo/pausado, null si sin estado). '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente vinculado.';

-- ---------------------------------------------------------------------------
-- get_mi_tratamiento_activo
-- ---------------------------------------------------------------------------
-- Devuelve el resumen de progreso del tratamiento activo del paciente caller.
-- Espeja mapAsignacionToPaciente.ts línea a línea: misma cascada semanasTotales,
-- mismo criterio nivelActual, misma regla proximaEvaluacion.
--
-- Las 7 claves del contrato (D-3):
--   nivelActual         → primer nivel sin fecha_seguimiento_real (asc), o el último
--   nivelesTotales      → modalidades.cantidad_niveles
--   semanaActual        → floor((hoy - fecha_inicio)/7) + 1, capeada a semanasTotales, nunca menor que 1
--   semanasTotales      → cascada: ceil((maxEsperada - inicio)/7) → cantidad_sesiones → cantidad_niveles*4
--   fechaInicio         → etapas_tratamiento.fecha_inicio
--   proximaEvaluacion   → min(fecha_seguimiento_esperada) futura, comparación estricta
--   estado              → estados_paciente.codigo del paciente (no de la etapa)
--
-- NO devuelve etapaActual/etapasTotales (número de etapa no aplica aquí).
--
-- Una etapa sin arrancar (fecha_inicio null) NO es un tratamiento activo: la
-- resolución de la etapa activa la excluye explícitamente y el paciente cae
-- en sin_etapa_activa, la misma respuesta que si no tuviera tratamiento
-- (Task 5.1, D-6). Evita que greatest/least (que ignoran nulls) reporten
-- "Semana 1 de 1" para un tratamiento que todavía no empezó.
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- entrega_liberada
--
-- La regla del goteo semanal, en un solo lugar (seguridadPanel / SEG-002): una
-- entrega del plan está liberada cuando hoy ya llegó al inicio de su semana.
--   semana          = floor(dia_offset / 7) + 1
--   fechaDesbloqueo = fecha_inicio + (semana - 1) * 7
--   liberada        = public.hoy() >= fechaDesbloqueo
-- La usan get_mi_plan_semanal (estadoSemana = 'futura' es "no liberada") y
-- paciente_puede_ver_objeto (la policy de lectura de Storage). Al compartirla,
-- lo que el RPC le entrega a la app y lo que el bucket deja firmar no pueden
-- divergir. Cambiar la regla acá cambia las dos cosas a la vez.
--
-- fecha_inicio null (etapa sin arrancar) → false: falla cerrado.
--
-- security invoker: no lee tablas. Privada: solo la llaman funciones security
-- definer, que corren como owner; ni anon ni authenticated la ejecutan.
-- ---------------------------------------------------------------------------

create or replace function public.entrega_liberada(
  p_fecha_inicio date,
  p_dia_offset   integer
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    public.hoy() >= p_fecha_inicio + floor(p_dia_offset / 7)::int * 7,
    false
  );
$$;

comment on function public.entrega_liberada(date, integer) is
  'Regla única del goteo semanal: true si public.hoy() >= fecha_inicio + floor(dia_offset/7)*7 (el inicio de la semana de esa entrega). '
  'fecha_inicio null → false. La comparten get_mi_plan_semanal (estadoSemana futura = no liberada) y paciente_puede_ver_objeto (policy de lectura de Storage). '
  'Privada: sin execute para anon ni authenticated; la llaman funciones security definer.';

revoke execute on function public.entrega_liberada(date, integer) from public, anon, authenticated;
grant execute on function public.entrega_liberada(date, integer) to service_role;

-- ---------------------------------------------------------------------------
-- paciente_puede_ver_objeto
--
-- Rama "paciente" de las policies de lectura de storage.objects de los buckets
-- contenidos y contenidos-imagenes (ver docs/rls/). La app
-- del paciente firma ella misma las URLs con los paths que le da
-- get_mi_plan_semanal; esta función decide qué paths puede firmar.
--
-- true solo si el usuario actual es un paciente con tratamiento en curso y el
-- objeto pertenece a una entrega YA LIBERADA de ese tratamiento:
--   - bucket contenidos          → contenidos.recurso_ref = p_name
--   - bucket contenidos-imagenes → contenido_imagenes.path = p_name
-- La etapa es la misma que resuelve get_mi_plan_semanal (activa, arrancada, la
-- de fecha_inicio más reciente) y la liberación es public.entrega_liberada.
--
-- Authz NULL-safe: sin usuario, auth.uid() es null, `p.user_id = null` no
-- matchea ninguna fila y el exists devuelve false. Terapeutas y admins no son
-- pacientes: para ellos devuelve false y entran por la otra rama de la policy
-- (is_console_user).
--
-- security definer: pacientes, etapas_tratamiento, entregas_plan, contenidos y
-- contenido_imagenes no son legibles por un paciente (RLS de consola).
--
-- Grants: authenticated NECESITA execute. La policy se evalúa con el rol del
-- que consulta storage.objects, y Postgres chequea el privilegio de ejecución
-- contra ese rol aunque la función sea definer; sin el grant, toda lectura del
-- bucket falla con "permission denied for function". Que un paciente la llame
-- por PostgREST no filtra nada: solo responde true para lo que él ya puede
-- abrir. anon no la ejecuta.
-- ---------------------------------------------------------------------------

create or replace function public.paciente_puede_ver_objeto(
  p_bucket text,
  p_name   text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with etapa as (
    select et.id, et.fecha_inicio
      from public.etapas_tratamiento as et
      join public.pacientes as p on p.id = et.paciente_id
     where p.user_id = (select auth.uid())
       and et.fecha_finalizacion is null
       and et.fecha_inicio is not null
     order by et.fecha_inicio desc, et.created_at desc
     limit 1
  )
  select exists (
    select 1
      from etapa as e
      join public.entregas_plan as ep on ep.etapa_id = e.id
      join public.contenidos as c on c.id = ep.contenido_id
     where public.entrega_liberada(e.fecha_inicio, ep.dia_offset)
       and (
         (p_bucket = 'contenidos' and c.recurso_ref = p_name)
         or (
           p_bucket = 'contenidos-imagenes'
           and exists (
             select 1
               from public.contenido_imagenes as ci
              where ci.contenido_id = c.id
                and ci.path = p_name
           )
         )
       )
  );
$$;

comment on function public.paciente_puede_ver_objeto(text, text) is
  'Rama "paciente" de las policies de lectura de Storage (buckets contenidos y contenidos-imagenes): true si el usuario actual es un paciente con tratamiento en curso y el objeto (recurso_ref o contenido_imagenes.path) pertenece a una entrega ya liberada de su plan, con la misma regla que get_mi_plan_semanal (public.entrega_liberada). '
  'False para consola, para usuarios sin paciente vinculado y sin sesión. authenticated la ejecuta porque la evalúa la policy; anon no.';

revoke execute on function public.paciente_puede_ver_objeto(text, text) from public, anon;
grant execute on function public.paciente_puede_ver_objeto(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_mi_plan_semanal
-- ---------------------------------------------------------------------------
-- Devuelve el plan de tratamiento semanal completo del paciente caller.
-- Lee las entregas_plan de la etapa activa + join a contenidos, deriva
-- semana, fechaDesbloqueo y estadoSemana, y devuelve el array de semanas con
-- sus piezas y las 3 frases motivacionales derivadas de la etapa (Task 2.2,
-- frasesAutomaticas). Las frases NO se leen de entregas_plan.frase_id ni de
-- frases_motivacionales (esa columna/join fueron retirados en esta task) —
-- se derivan invocando la función privada public.frases_de_etapa(v_etapa_id)
-- (Task 0.3, epic-0), que ya devuelve la relación (semana, orden, origen,
-- texto) lista para joinear por semana.
--
-- Contrato de respuesta (array jsonb):
--   [{ semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo,
--      descripcion, recursoRef, duracion }],
--      frases: [{ orden, origen, texto }] }]
--
-- Nulling de futuras (DEC-3-2, extendido por DEC-2-2): para estadoSemana =
-- 'futura', recursoRef por pieza y frases de la semana viajan vacíos/null.
-- El resto de los campos de la pieza (id/tipo/titulo/descripcion/duracion)
-- siempre viajan → la app muestra un teaser bloqueado pero el path del
-- bucket y las frases nunca salen del server antes de tiempo.
--
-- recursoRef (DEC-3-3): es el path del objeto en el bucket (contenidos.recurso_ref),
-- NO una URL firmada. El mobile firma client-side con storage.createSignedUrl.
--
-- frases (DEC-2-1, DEC-2-3): la lista de semanas sale de semanas_de_etapa (todas
-- las semanas del tratamiento, tengan o no media cargada — planBorrador DEC-17);
-- frases_de_etapa solo aporta el contenido de cada semana, nunca agrega
-- semanas nuevas. frases es un array de hasta 3 objetos { orden, origen,
-- texto }, ordenados por orden, coalesced a [] cuando la semana no tiene
-- frases derivadas (run-out del catálogo, hoy imposible) o es futura. El
-- campo escalar `frase` desaparece del contrato: sin período de compatibilidad.
--
-- estadoSemana (DEC-3-1): ventana semiabierta [fechaDesbloqueo, fechaDesbloqueo+7).
--   futura   → public.hoy() < fechaDesbloqueo  (= not public.entrega_liberada)
--   actual   → fechaDesbloqueo <= public.hoy() < fechaDesbloqueo + 7
--   anterior → public.hoy() >= fechaDesbloqueo + 7
-- Las ventanas tilean exactamente (dia_offset = (semana-1)*7) → una sola actual.
--
-- Una etapa sin arrancar (fecha_inicio null) NO es un tratamiento activo: la
-- resolución de la etapa activa la excluye explícitamente y el paciente cae
-- en sin_etapa_activa (Task 5.1, D-6). Sin este gate, fecha_desbloqueo sale
-- NULL para todas las semanas y el case de estadoSemana no matchea ninguna
-- rama ('futura'/'anterior' comparan contra NULL) → todo cae en 'actual' y
-- el nulling de recursoRef deja de aplicar: fuga de todo el plan de una vez.
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas. Además es lo que
--   habilita a este RPC a invocar frases_de_etapa, que es privada (revocada
--   de public y de authenticated) y solo la puede invocar un definer.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
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
  --    La cantidad de semanas sale de semanas_de_etapa, no de las entregas cargadas.
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
    -- fueron retirados de esta CTE; la lista de semanas sale de semanas_de_etapa
    -- (DEC-17), pero su contenido de frases se resuelve más
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
    -- Una fila por semana del tratamiento (semanas_de_etapa = cantidad_niveles * 4),
    -- tenga o no contenido (planBorrador, DEC-17). fecha_desbloqueo = inicio de la
    -- semana. semanas_de_etapa null (etapa sin modalidad) → sin filas → [].
    select
      g.semana,
      (v_fecha_inicio + (g.semana - 1) * 7)::date as fecha_desbloqueo
    from generate_series(1, public.semanas_de_etapa(v_etapa_id)) as g (semana)
  ),
  marcadas as (
    -- estadoSemana por semana. Ventana semiabierta [desbloqueo, desbloqueo+7).
    select
      s.semana,
      s.fecha_desbloqueo,
      -- 'futura' sale de public.entrega_liberada, la MISMA función que usa la
      -- policy de lectura de Storage (paciente_puede_ver_objeto): lo que este
      -- RPC oculta es exactamente lo que el bucket rechaza. (semana - 1) * 7
      -- es el dia_offset del inicio de la semana, o sea fecha_desbloqueo.
      case
        when not public.entrega_liberada(v_fecha_inicio, (s.semana - 1) * 7) then 'futura'
        when public.hoy() >= s.fecha_desbloqueo + 7 then 'anterior'
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
      -- por (orden, dia_offset). recursoRef E imagenes nuleados server-side
      -- para futuras, en el MISMO case cada uno (design §6 ADR-5): ambos
      -- keys leen el mismo m.estado_semana en el mismo scope, y el case de
      -- imagenes corta en corto en 'futura' — el subquery a
      -- contenido_imagenes directamente NO SE EVALÚA para una semana futura,
      -- los paths no solo se descartan, nunca se leen. No repetir el error de
      -- separar esta regla en un case/CTE distinto (así casi se pierde
      -- `frases`, ver DEC-9). Semana sin media devuelve piezas: [] (coalesce).
      'piezas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',          b.pieza_id,
            'tipo',        b.pieza_tipo,
            'titulo',      b.pieza_titulo,
            'descripcion', b.pieza_descripcion,
            'recursoRef',  case when m.estado_semana = 'futura' then null else b.pieza_recurso_ref end,
            'imagenes',    case
                              when m.estado_semana = 'futura' then '[]'::jsonb
                              else coalesce((
                                select jsonb_agg(
                                         jsonb_build_object('path', ci.path, 'orden', ci.orden)
                                         order by ci.orden)
                                  from public.contenido_imagenes as ci
                                 where ci.contenido_id = b.pieza_id
                              ), '[]'::jsonb)
                            end,
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

grant execute on function public.get_mi_plan_semanal() to authenticated;

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, imagenes: [{path, orden}], duracion }], frases: [{ orden, origen, texto }] }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'La lista de semanas sale de semanas_de_etapa (cantidad_niveles × 4): todas las semanas del tratamiento, tengan o no media cargada (piezas: [] si no tiene); '
  'frases se deriva invocando public.frases_de_etapa(v_etapa_id) (Task 0.3) y se joinea por semana, '
  'nunca agrega semanas nuevas. frases trae hasta 3 objetos ordenados por orden; [] si la semana no tiene '
  'frases derivadas (run-out del catálogo) o si es futura (DEC-2-2, misma nulling que recursoRef). '
  'imagenes trae el array ordenado {path, orden} de contenido_imagenes para piezas tipo galería (cma/ic); '
  '[] para toda pieza no-galería (no hay filas). '
  'El campo escalar frase (deprecado) NO existe en este contrato: no se lee entregas_plan.frase_id ni frases_motivacionales. '
  'Nulling de futuras: recursoRef por pieza = null e imagenes = [] (subquery nunca evaluado) y frases = [] cuando estadoSemana = futura — NO NEGOCIABLE, evita filtrar paths de bucket de semanas no desbloqueadas. '
  'recursoRef e imagenes[].path son paths del bucket, NO URLs firmadas — el mobile firma client-side. '
  'Etapa sin modalidad (semanas_de_etapa null) → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe '
  'pero no arrancó (fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

-- ---------------------------------------------------------------------------
-- get_mi_evaluacion_vigente
-- ---------------------------------------------------------------------------
-- Determina el nivel vigente del paciente caller: el menor numero_nivel cuya
-- fecha_seguimiento_esperada <= public.hoy() y que no tiene fila en
-- nivel_evaluacion. Para ese nivel, arma las 2 frases esperadas (causa y
-- algoritmo) con mapeo 1:1 numero_etapa = numero_nivel.
--
-- Contrato de respuesta:
--   { vigente: false }                                ← sin nivel pendiente
--   { vigente: true, nivelId, resultadoEsperado: {   ← nivel pendiente
--       causa: text | null,
--       algoritmo: text | null } }
--
-- Mapeo 1:1 (DEC-4-2, §9.3 #2): numero_etapa = numero_nivel directo.
-- causa_etapas / algoritmo_etapas tienen numero_etapa 1..4 (una entrada por
-- nivel en toda modalidad de 4 niveles). Frase null si falta la fila de
-- catálogo — no se interrumpe la pantalla de evaluación.
--
-- Fechas null legacy (< Epic 0): la comparación <= public.hoy() es false para
-- null → esos niveles nunca son vigentes (sin manejo explícito).
--
-- Una etapa sin arrancar (fecha_inicio null) NO es un tratamiento activo: la
-- resolución de la etapa activa la excluye explícitamente y el paciente cae
-- en sin_etapa_activa (Task 5.1, D-6).
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

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
  --    <= public.hoy() excluye nulls legacy (la comparación con null es false).
  --    not exists sobre nivel_evaluacion garantiza que el nivel no fue respondido.
  --    order by numero_nivel asc limit 1: si hay varios vencidos, el menor primero.
  select n.id, n.numero_nivel
    into v_nivel_id, v_numero_nivel
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada <= public.hoy()
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

grant execute on function public.get_mi_evaluacion_vigente() to authenticated;

comment on function public.get_mi_evaluacion_vigente() is
  'Determina el nivel vigente del paciente caller: el menor numero_nivel con '
  'fecha_seguimiento_esperada <= public.hoy() y sin fila en nivel_evaluacion. '
  'Para ese nivel, arma las 2 frases esperadas con mapeo 1:1 numero_etapa = numero_nivel '
  'desde causa_etapas (causa_id de la etapa) y algoritmo_etapas (algoritmo_id de la etapa). '
  'Devuelve { vigente: false } si no hay nivel pendiente; '
  '{ vigente: true, nivelId, resultadoEsperado: { causa, algoritmo } } si hay uno. '
  'Frases null si falta la fila de catálogo (no interrumpe la pantalla de evaluación). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

-- ---------------------------------------------------------------------------
-- get_mi_estructura_actual
-- ---------------------------------------------------------------------------
-- Devuelve las mediciones de estructura bioenergética de la etapa activa del
-- paciente caller (feature medicionEvolutiva). Excluye cierre_automatico
-- (DEC-M06): esa fila la genera el sistema cuando una etapa cierra sin una
-- medición explícita, no es una lectura real del paciente y nunca debe
-- llegar a su propio historial.
--
-- Contrato de respuesta (jsonb, orden cronológico):
--   { mediciones: [{ id, fecha, momento, estructuraGeneral,
--       valores: [{ codigo, etiquetaPaciente, orden, valor }] }] }
--   mediciones es [] (nunca un error) cuando la etapa activa todavía no tiene ninguna.
--
-- fecha: registrada_en convertida a America/Argentina/Buenos_Aires y
-- truncada a date, resuelta server-side — la clínica es Argentina-only y no
-- existe timezone de clínica en SQL, así que el timezone del dispositivo
-- nunca puede correr el día calendario de una medición.
--
-- valores está denormalizado (codigo/etiquetaPaciente/orden) desde el catálogo
-- tal como está hoy — mismo enfoque que get_estructura_paciente
-- (78_rpcs_mediciones.sql). Este RPC nunca necesita distinguir versiones
-- históricas del catálogo (eso solo lo necesita el console).
--
-- Nunca devuelve registrada_por, copiada_de, identidad del terapeuta, `activo`,
-- historial de edición, ni ninguna otra etapa (design §8.1, spec S2).
--
-- Una etapa sin arrancar (fecha_inicio null) NO es un tratamiento activo:
-- mismo gate que los otros 4 RPCs de lectura del paciente (Task 5.1, D-6).
--
-- security definer: corre como owner porque las tablas subyacentes tienen
--   RLS terapeuta-only; el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_estructura_actual()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_result      jsonb;
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

  -- 3. Proyectar las mediciones de la etapa, orden cronológico, excluyendo
  --    cierre_automatico (DEC-M06). fecha resuelta en
  --    America/Argentina/Buenos_Aires server-side (la clínica es Argentina-only).
  select jsonb_build_object('mediciones', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', me.id,
      -- La clínica es Argentina-only; no existe timezone de clínica en SQL.
      -- Resuelto server-side para que el timezone del dispositivo nunca corra el día.
      'fecha', (me.registrada_en at time zone 'America/Argentina/Buenos_Aires')::date,
      'momento', me.momento,
      'estructuraGeneral', me.estructura_general,
      'valores', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'codigo', ce.codigo, 'etiquetaPaciente', ce.etiqueta_paciente,
                 'orden', ce.orden, 'valor', mv.valor) order by ce.orden)
          from public.medicion_valores as mv
          join public.centros_energeticos as ce on ce.id = mv.centro_id
         where mv.medicion_id = me.id), '[]'::jsonb))
    order by me.registrada_en asc, me.id asc), '[]'::jsonb))
    into v_result
    from public.mediciones_estructura as me
   where me.etapa_id = v_etapa_id
     and me.momento <> 'cierre_automatico';   -- DEC-M06

  return v_result;
end;
$$;

grant execute on function public.get_mi_estructura_actual() to authenticated;

comment on function public.get_mi_estructura_actual() is
  'Devuelve las mediciones de estructura bioenergética de la etapa activa del paciente caller (medicionEvolutiva): { mediciones: [{ id, fecha, momento, estructuraGeneral, valores: [{codigo, etiquetaPaciente, orden, valor}] }] }, orden cronológico, excluyendo cierre_automatico (DEC-M06). fecha = registrada_en convertida a America/Argentina/Buenos_Aires, resuelta server-side. valores denormaliza codigo/etiquetaPaciente/orden desde el catálogo vigente. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó (fecha_inicio null); no_vinculado (P0001) si no hay vínculo.';

-- ---------------------------------------------------------------------------
-- submit_mi_evaluacion
-- ---------------------------------------------------------------------------
-- Único RPC de escritura del feature: recibe los 2 scores del paciente (causa
-- y algoritmo, 1..5 cada uno), valida pertenencia del nivel a la etapa activa
-- del caller (anti-IDOR), y persiste el promedio (causa+algoritmo)/2.0 como
-- único score en nivel_evaluacion de forma atómica e idempotente.
--
-- Orden de validación (DEC-4-3):
--   1. get_mi_paciente_id()                       → no_vinculado (P0001)
--   2. etapa activa del caller (fecha_inicio not null — Task 5.1, D-6:
--      una etapa sin arrancar NO es un tratamiento activo)
--                                                  → sin_etapa_activa (P0001)
--   3. scores 1..5                                → score_invalido (P0001)
--   4. nivel pertenece a la etapa activa          → nivel_ajeno (P0001)
--   5. insert atómico; captura unique_violation   → ya_respondida (P0001)
--   6. return { ok: true }
--
-- Idempotencia: apoyada en unique constraint nivel_id (50_nivel_evaluacion.sql:3).
-- Sin pre-check SELECT EXISTS (eso sería TOCTOU) — el constraint es la única
-- fuente de verdad, race-safe ante reintento offline y doble-submit concurrente.
--
-- Sin gate de vencido (DEC-4-3, §16 #1): el submit no exige
-- fecha_seguimiento_esperada <= hoy; en la práctica el mobile solo expone el
-- nivel vigente. El hardening (eval_no_vigente) está diferido.
--
-- volatile (escribe): no stable. set search_path = '': todas las referencias
-- deben ser schema-cualificadas. security definer: la RLS de nivel_evaluacion
-- es select-only terapeuta; el paciente escribe exclusivamente vía este RPC.
-- ---------------------------------------------------------------------------

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

grant execute on function public.submit_mi_evaluacion(uuid, int, int) to authenticated;

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
