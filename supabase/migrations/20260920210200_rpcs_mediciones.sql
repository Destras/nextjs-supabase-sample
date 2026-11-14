-- Mirrors supabase/schemas/78_rpcs_mediciones.sql — the four private
-- helpers first, then the four public RPCs, exactly as declared there
-- (comments included). DDL only: EXECUTE grants/revokes are NOT here on
-- purpose — migra does not detect them, and per design §2 they are
-- consolidated in a single hand-authored migration that must run AFTER M4
-- (20260920210400_mediciones_grants.sql, "M5"), because `create or replace`
-- on the M4 functions re-triggers this project's default privilege grant.
--
-- Hand-authored (db diff is broken here — see M1's header).
--
-- Must run BEFORE M4 (20260920210300_cierre_con_medicion_y_alertas.sql):
-- M4's replaced cerrar_etapa body calls _generar_cierre_automatico, defined
-- here.
--
-- sdd/medir-chakras PR1 (E0: Database & Security Foundation), design §2 M3.

-- ---------------------------------------------------------------------------
-- Mediciones de estructura energética (feature medirChakras)
-- ---------------------------------------------------------------------------
-- Cuatro RPCs públicas (tres de escritura, una de lectura) más cuatro
-- helpers privados. Toda regla clínica vive acá, security definer; el
-- cliente es una proyección (design §0).
--
-- ⚠️ El disjunto is_admin() NO es uniforme entre estas cuatro RPCs — ver
-- design §1.0 / sdd/medir-chakras/grill-decisions DEC-31 (corregida).
-- get_estructura_paciente (lectura) autoriza con
-- has_active_assignment(...) or is_admin(). registrar_medicion,
-- cerrar_etapa_con_medicion y editar_medicion autorizan SOLO con
-- has_active_assignment(...)/la regla de 4 condiciones — NUNCA con
-- is_admin() como disjunto: un admin sin asignación puede CERRAR un
-- tratamiento (cerrar_etapa, 71_rpcs_pacientes.sql) pero nunca MEDIR. Un
-- test que asuma "admin sin asignación puede registrar_medicion" está mal.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- _validar_valores_medicion
-- ---------------------------------------------------------------------------
-- Única implementación de la validación de p_valores (design §1.1), llamada
-- por las tres RPCs de escritura. No toca ninguna tabla: el set de centros
-- esperado lo decide el caller (el catálogo activo para
-- registrar_medicion/cerrar_etapa_con_medicion, el set propio de la medición
-- para editar_medicion — así una medición vieja sigue editable después de un
-- cambio de catálogo).
--
-- Forma esperada de p_valores:
--   { "estructura_general": 55, "centros": [ { "centro_id": "uuid", "valor": 70 }, ... ] }
--
-- Un array (no un objeto keyed por centro_id) a propósito: un objeto jsonb
-- no puede representar una clave duplicada (un centro enviado dos veces se
-- dedupicaría en silencio, last-wins), un array sí puede rechazarla — el
-- chequeo de duplicados del paso 5 depende de esto.
--
-- Siempre levanta 22023/valores_invalidos (el `message` es la clave estable
-- para el switch del cliente); `hint` lleva el campo puntual ofensivo
-- (estructura_general o un centro uuid, null si el error es de conjunto);
-- `detail` es un string JSON {"motivo": ..., "campo"|"campos": ...} — R1: si
-- el PostgREST desplegado no expone `hint`, `campo` va duplicado adentro de
-- `detail` para que alcance solo.
create or replace function public._validar_valores_medicion(
  p_valores           jsonb,
  p_centros_esperados uuid[]
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys           text[];
  v_estructura_txt text;
  v_elemento       jsonb;
  v_elemento_keys  text[];
  v_centro_txt     text;
  v_centro_id      uuid;
  v_valor_txt      text;
  v_ids            uuid[] := array[]::uuid[];
  v_id_count       int;
  v_distinct_count int;
  v_faltantes      uuid[];
  v_desconocidos   uuid[];
begin
  -- 1. Forma exacta del objeto raíz: exactamente {centros, estructura_general}.
  if jsonb_typeof(p_valores) is distinct from 'object' then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'claves_extra')::text;
  end if;

  select array_agg(key order by key) into v_keys from jsonb_object_keys(p_valores) as key;

  if v_keys is distinct from array['centros', 'estructura_general'] then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'claves_extra')::text;
  end if;

  -- 2. centros debe ser un array.
  if jsonb_typeof(p_valores -> 'centros') is distinct from 'array' then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'formato_invalido', 'campo', 'centros')::text;
  end if;

  -- 3. estructura_general: número entero 0-100. trunc() rechaza decimales (5.5).
  if jsonb_typeof(p_valores -> 'estructura_general') is distinct from 'number' then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            hint    = 'estructura_general',
            detail  = jsonb_build_object('motivo', 'fuera_de_rango', 'campo', 'estructura_general')::text;
  end if;

  v_estructura_txt := p_valores ->> 'estructura_general';

  if v_estructura_txt::numeric <> trunc(v_estructura_txt::numeric)
     or v_estructura_txt::numeric < 0
     or v_estructura_txt::numeric > 100
  then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            hint    = 'estructura_general',
            detail  = jsonb_build_object(
                        'motivo', 'fuera_de_rango',
                        'campo', 'estructura_general',
                        'valor', v_estructura_txt::numeric
                      )::text;
  end if;

  -- 4. Cada elemento de centros: objeto exacto {centro_id, valor}, ambos válidos.
  for v_elemento in select value from jsonb_array_elements(p_valores -> 'centros')
  loop
    if jsonb_typeof(v_elemento) is distinct from 'object' then
      raise exception 'valores_invalidos'
        using errcode = '22023',
              detail  = jsonb_build_object('motivo', 'claves_extra')::text;
    end if;

    select array_agg(key order by key) into v_elemento_keys from jsonb_object_keys(v_elemento) as key;

    if v_elemento_keys is distinct from array['centro_id', 'valor'] then
      raise exception 'valores_invalidos'
        using errcode = '22023',
              detail  = jsonb_build_object('motivo', 'claves_extra')::text;
    end if;

    v_centro_txt := v_elemento ->> 'centro_id';

    begin
      v_centro_id := v_centro_txt::uuid;
    exception
      when others then
        raise exception 'valores_invalidos'
          using errcode = '22023',
                detail  = jsonb_build_object('motivo', 'formato_invalido', 'campo', v_centro_txt)::text;
    end;

    if jsonb_typeof(v_elemento -> 'valor') is distinct from 'number' then
      raise exception 'valores_invalidos'
        using errcode = '22023',
              hint    = v_centro_id::text,
              detail  = jsonb_build_object('motivo', 'fuera_de_rango', 'campo', v_centro_id)::text;
    end if;

    v_valor_txt := v_elemento ->> 'valor';

    if v_valor_txt::numeric <> trunc(v_valor_txt::numeric)
       or v_valor_txt::numeric < 0
       or v_valor_txt::numeric > 100
    then
      raise exception 'valores_invalidos'
        using errcode = '22023',
              hint    = v_centro_id::text,
              detail  = jsonb_build_object(
                          'motivo', 'fuera_de_rango',
                          'campo', v_centro_id,
                          'valor', v_valor_txt::numeric
                        )::text;
    end if;

    v_ids := v_ids || v_centro_id;
  end loop;

  -- 5. Sin duplicados: un objeto jsonb los hubiera dedupicado en silencio
  --    (last-wins); el array los expone.
  select count(*), count(distinct c) into v_id_count, v_distinct_count
    from unnest(v_ids) as c;

  if v_id_count <> v_distinct_count then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'centros_duplicados')::text;
  end if;

  -- 6. Igualdad de conjuntos contra los centros esperados (decide el caller).
  select array_agg(c) into v_faltantes
    from unnest(p_centros_esperados) as c
   where c <> all (v_ids);

  if v_faltantes is not null then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'centros_faltantes', 'campos', v_faltantes)::text;
  end if;

  select array_agg(c) into v_desconocidos
    from unnest(v_ids) as c
   where c <> all (p_centros_esperados);

  if v_desconocidos is not null then
    raise exception 'valores_invalidos'
      using errcode = '22023',
            detail  = jsonb_build_object('motivo', 'centros_desconocidos', 'campos', v_desconocidos)::text;
  end if;
end;
$$;

comment on function public._validar_valores_medicion(jsonb, uuid[]) is
  'Única implementación de la validación de p_valores ({estructura_general, centros:[{centro_id,valor}]}), 0-100 enteros, sin duplicados, set-equality exacta contra p_centros_esperados (decide el caller: catálogo activo o set propio de la medición). Siempre levanta 22023/valores_invalidos; detail lleva {motivo, campo|campos} en JSON, hint el campo puntual. Privada: sin authz propia, no toca tablas.';

-- ---------------------------------------------------------------------------
-- _medicion_editable
-- ---------------------------------------------------------------------------
-- Única implementación de la regla de 4 condiciones (design §1.2/§9.4).
-- Devuelve TEXT, no boolean: null = editable, si no un motivo de un enum
-- cerrado. get_estructura_paciente proyecta esto en editable/editable_motivo;
-- editar_medicion lo usa para autorizar y lo levanta como detail. Una sola
-- implementación con dos proyecciones — el split-brain que evita es que la
-- UI reinvente el "por qué" (design §18).
--
-- Orden de evaluación (primer match gana ⇒ el mensaje más específico):
--   automatica               → momento = cierre_automatico
--   otro_terapeuta            → registrada_por <> auth.uid()
--   no_es_ultima              → no es la última (registrada_en, id) de su etapa
--   etapa_posterior_iniciada  → existe una etapa posterior del mismo paciente ya arrancada
--   sin_asignacion            → el caller no tiene asignación activa sobre el paciente
--   null                      → editable
--
-- auth.uid() dentro de una función security definer resuelve el JWT del
-- CALLER (no el owner) — mismo mecanismo que usa marcar_alerta_atendida.
create or replace function public._medicion_editable(p_medicion_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_momento            text;
  v_registrada_por     uuid;
  v_registrada_en      timestamptz;
  v_etapa_id           uuid;
  v_paciente_id        uuid;
  v_fecha_cmp          date;
  v_max_registrada_en  timestamptz;
  v_max_id             uuid;
begin
  select m.momento, m.registrada_por, m.registrada_en, m.etapa_id, e.paciente_id,
         coalesce(e.fecha_inicio, e.created_at::date)
    into v_momento, v_registrada_por, v_registrada_en, v_etapa_id, v_paciente_id, v_fecha_cmp
    from public.mediciones_estructura m
    join public.etapas_tratamiento e on e.id = m.etapa_id
   where m.id = p_medicion_id;

  if not found then
    -- No debería ocurrir: editar_medicion valida existencia antes de llamar
    -- acá, y get_estructura_paciente solo invoca esto sobre filas que acaba
    -- de leer. Falla cerrado igual, nunca "editable" ante lo inesperado.
    return 'no_es_ultima';
  end if;

  if v_momento = 'cierre_automatico' then
    return 'automatica';
  end if;

  if v_registrada_por is distinct from auth.uid() then
    return 'otro_terapeuta';
  end if;

  select m2.registrada_en, m2.id
    into v_max_registrada_en, v_max_id
    from public.mediciones_estructura m2
   where m2.etapa_id = v_etapa_id
   order by m2.registrada_en desc, m2.id desc
   limit 1;

  if v_max_registrada_en is distinct from v_registrada_en or v_max_id is distinct from p_medicion_id then
    return 'no_es_ultima';
  end if;

  if exists (
    select 1
      from public.etapas_tratamiento e2
     where e2.paciente_id = v_paciente_id
       and e2.fecha_inicio is not null
       and coalesce(e2.fecha_inicio, e2.created_at::date) > v_fecha_cmp
  ) then
    return 'etapa_posterior_iniciada';
  end if;

  if not public.has_active_assignment(v_paciente_id) then
    return 'sin_asignacion';
  end if;

  return null;
end;
$$;

comment on function public._medicion_editable(uuid) is
  'Única implementación de la regla de 4 condiciones de edición (design §1.2/§9.4). null = editable; si no, motivo del enum cerrado (automatica|otro_terapeuta|no_es_ultima|etapa_posterior_iniciada|sin_asignacion), primer match gana. get_estructura_paciente y editar_medicion son sus dos únicos proyectores — nunca recomputar la regla en otro lado. Sin disjunto de admin.';

-- ---------------------------------------------------------------------------
-- _insertar_medicion
-- ---------------------------------------------------------------------------
-- Inserta la cabecera (registrada_por = auth.uid(), copiada_de = null) y el
-- detalle por centro desde p_valores->'centros'. Existe solo para que
-- registrar_medicion y cerrar_etapa_con_medicion no carguen el mismo par de
-- inserts dos veces. NO toma decisiones de autorización — el caller ya
-- autorizó.
create or replace function public._insertar_medicion(
  p_etapa_id uuid,
  p_momento  text,
  p_valores  jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_medicion_id uuid;
begin
  insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por)
  values (p_etapa_id, p_momento, (p_valores ->> 'estructura_general')::int, auth.uid())
  returning id into v_medicion_id;

  insert into public.medicion_valores (medicion_id, centro_id, valor)
  select v_medicion_id,
         (elem ->> 'centro_id')::uuid,
         (elem ->> 'valor')::int
    from jsonb_array_elements(p_valores -> 'centros') as elem;

  return v_medicion_id;
end;
$$;

comment on function public._insertar_medicion(uuid, text, jsonb) is
  'Inserta cabecera (registrada_por = auth.uid(), copiada_de = null) + detalle por centro desde p_valores. Comparte el par de inserts entre registrar_medicion y cerrar_etapa_con_medicion. Sin authz propia: el caller ya autorizó y ya validó p_valores.';

-- ---------------------------------------------------------------------------
-- _generar_cierre_automatico
-- ---------------------------------------------------------------------------
-- Clona la última medición real de una etapa como cierre_automatico cuando
-- la etapa se cierra sin que el terapeuta haya medido en el cierre mismo
-- (cerrar_etapa, baja_voluntaria_paciente). No-op (return null) si la etapa
-- no existe, no arrancó, no tiene mediciones previas, o ya tiene un cierre
-- (defensa en profundidad contra el 23505 del índice único parcial —
-- ningún caller de hoy reentra acá, pero convierte lo que sería un error en
-- un no-op silencioso, preservando el contrato de reentrada idempotente de
-- baja_voluntaria_paciente).
--
-- 🔴 CONTRATO NO NEGOCIABLE: esta función NO toma NINGUNA decisión de
-- autorización, y no puede tomarla — para cuando baja_voluntaria_paciente la
-- llama, la asignación ya está terminada (76_...:129-133, antes del cierre de
-- etapa) y corre bajo service_role (auth.uid() es null). Sus callers
-- autorizan ANTES de invocarla. Es precisamente por esto que los revokes de
-- esta función (design §2.5) no son higiene — son el control de acceso.
create or replace function public._generar_cierre_automatico(p_etapa_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fecha_inicio     date;
  v_ultima_id        uuid;
  v_cierre_existente boolean;
  v_nuevo_id         uuid;
begin
  select fecha_inicio into v_fecha_inicio
    from public.etapas_tratamiento
   where id = p_etapa_id;

  if not found or v_fecha_inicio is null then
    return null;
  end if;

  select id into v_ultima_id
    from public.mediciones_estructura
   where etapa_id = p_etapa_id
   order by registrada_en desc, id desc
   limit 1;

  if v_ultima_id is null then
    return null;
  end if;

  select exists (
    select 1 from public.mediciones_estructura
     where etapa_id = p_etapa_id
       and momento in ('cierre', 'cierre_automatico')
  ) into v_cierre_existente;

  if v_cierre_existente then
    return null;
  end if;

  insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por, copiada_de)
  select etapa_id, 'cierre_automatico', estructura_general, null, id
    from public.mediciones_estructura
   where id = v_ultima_id
  returning id into v_nuevo_id;

  insert into public.medicion_valores (medicion_id, centro_id, valor)
  select v_nuevo_id, centro_id, valor
    from public.medicion_valores
   where medicion_id = v_ultima_id;

  return v_nuevo_id;
end;
$$;

comment on function public._generar_cierre_automatico(uuid) is
  'Clona la última medición real de una etapa como cierre_automatico (registrada_por null, copiada_de = la original) cuando la etapa se cierra sin medición explícita. No-op si la etapa no existe/no arrancó/no tiene mediciones/ya tiene un cierre. CERO decisiones de autorización — sus callers (cerrar_etapa, baja_voluntaria_paciente) autorizan antes; los revokes de esta función SON el control de acceso, no higiene.';

-- ---------------------------------------------------------------------------
-- get_estructura_paciente
-- ---------------------------------------------------------------------------
-- Contrato central de lectura (design §1.5): jsonb con puede_medir/es_admin,
-- el catálogo activo (solo para armar el formulario) y todas las etapas del
-- paciente con sus mediciones, cada una con editable/editable_motivo
-- server-side (nunca recomputados en el cliente).
--
-- `es_propia`, `editable_motivo`, `paciente_id` (eco del argumento, contra
-- una respuesta tardía pintando el paciente equivocado) y `es_admin` (para
-- distinguir "admin sin asignación" de "asignación vencida", ambos con
-- puede_medir = false) están documentados en detalle en design §1.5.
--
-- `valores` va denormalizado (codigo/nombre/orden/activo): el catálogo NUNCA
-- se reinterpreta — una medición conserva los centros que midió, con su
-- nombre, aunque el catálogo cambie después.
create or replace function public.get_estructura_paciente(p_paciente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_puede_medir boolean;
  v_es_admin    boolean;
  v_resultado   jsonb;
begin
  v_puede_medir := public.has_active_assignment(p_paciente_id);
  v_es_admin    := public.is_admin();

  if not (v_puede_medir or v_es_admin) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  with etapas_ranked as (
    -- Mismo criterio de ordinal que derive_alertas_activas (65_alertas.sql):
    -- coalesce(fecha_inicio, created_at::date), desempate por id.
    select e.id, e.fecha_inicio, e.fecha_finalizacion, ee.codigo as estado,
           row_number() over (
             order by coalesce(e.fecha_inicio, e.created_at::date), e.id
           ) as ordinal
      from public.etapas_tratamiento e
      join public.estados_etapa ee on ee.id = e.estado_id
     where e.paciente_id = p_paciente_id
  ),
  mediciones_enriquecidas as (
    -- _medicion_editable se llama UNA vez por fila acá — get_estructura_paciente
    -- proyecta su resultado en editable (boolean) Y editable_motivo (texto),
    -- nunca dos invocaciones (R11: costo bounded a N llamadas por respuesta,
    -- no 2N).
    select m.id, m.etapa_id, m.momento, m.estructura_general, m.registrada_en,
           m.copiada_de,
           (m.registrada_por = auth.uid())            as es_propia,
           case when p2.id is null then null
                else jsonb_build_object('id', p2.id, 'nombre', p2.nombre) end as registrada_por_json,
           public._medicion_editable(m.id)             as motivo_no_editable
      from public.mediciones_estructura m
      left join public.profiles p2 on p2.id = m.registrada_por
     where m.etapa_id in (select id from etapas_ranked)
  ),
  valores_agrupados as (
    select mv.medicion_id,
           jsonb_agg(
             jsonb_build_object(
               'centro_id', mv.centro_id, 'codigo', c.codigo, 'nombre', c.nombre,
               'orden', c.orden, 'activo', c.activo, 'valor', mv.valor
             )
             order by c.orden
           ) as valores
      from public.medicion_valores mv
      join public.centros_energeticos c on c.id = mv.centro_id
     where mv.medicion_id in (select id from mediciones_enriquecidas)
     group by mv.medicion_id
  ),
  mediciones_por_etapa as (
    select me.etapa_id,
           jsonb_agg(
             jsonb_build_object(
               'id', me.id,
               'momento', me.momento,
               'estructura_general', me.estructura_general,
               'registrada_en', me.registrada_en,
               'registrada_por', me.registrada_por_json,
               'copiada_de', me.copiada_de,
               'es_propia', me.es_propia,
               'editable', me.motivo_no_editable is null,
               'editable_motivo', me.motivo_no_editable,
               'valores', coalesce(va.valores, '[]'::jsonb)
             )
             order by me.registrada_en, me.id
           ) as mediciones
      from mediciones_enriquecidas me
      left join valores_agrupados va on va.medicion_id = me.id
     group by me.etapa_id
  )
  select jsonb_build_object(
           'paciente_id',     p_paciente_id,
           'puede_medir',     v_puede_medir,
           'es_admin',        v_es_admin,
           'centros_activos', coalesce((
             select jsonb_agg(
                      jsonb_build_object(
                        'id', c.id, 'codigo', c.codigo, 'nombre', c.nombre,
                        'etiqueta_paciente', c.etiqueta_paciente, 'orden', c.orden
                      )
                      order by c.orden
                    )
               from public.centros_energeticos c
              where c.activo
           ), '[]'::jsonb),
           'etapas', coalesce((
             select jsonb_agg(
                      jsonb_build_object(
                        'id', er.id,
                        'ordinal', er.ordinal,
                        'fecha_inicio', er.fecha_inicio,
                        'fecha_finalizacion', er.fecha_finalizacion,
                        'estado', er.estado,
                        'iniciada', er.fecha_inicio is not null,
                        'mediciones', coalesce(mpe.mediciones, '[]'::jsonb)
                      )
                      order by er.ordinal
                    )
               from etapas_ranked er
               left join mediciones_por_etapa mpe on mpe.etapa_id = er.id
           ), '[]'::jsonb)
         )
    into v_resultado;

  return v_resultado;
end;
$$;

comment on function public.get_estructura_paciente(uuid) is
  'Contrato central de lectura de Estructura (design §1.5): jsonb {paciente_id, puede_medir, es_admin, centros_activos[], etapas[{..., mediciones[{..., es_propia, editable, editable_motivo, valores[]}]}]}. Autoriza con has_active_assignment(p) or is_admin() (única RPC de este archivo con disjunto de admin — es lectura, design §1.0). editable/editable_motivo vienen de _medicion_editable, nunca recomputados en el cliente. valores va denormalizado: el catálogo nunca se reinterpreta.';

-- ---------------------------------------------------------------------------
-- registrar_medicion
-- ---------------------------------------------------------------------------
-- Registra una nueva lectura (apertura si la etapa no tiene ninguna,
-- seguimiento si ya tiene) sobre una etapa arrancada y abierta. Autoriza
-- SOLO con has_active_assignment — sin disjunto de admin (design §1.0): un
-- admin sin asignación no puede medir clínicamente a un paciente.
--
-- p_medicion_previa_id SIN default a propósito: null es significativo ("creo
-- que esta etapa no tiene mediciones") y es lo que habilita una apertura. Un
-- default null convertiría "el caller se olvidó el parámetro" en "el caller
-- asegura que la etapa está vacía" — un modo de falla silencioso que
-- corrompe datos. Los callers pasan null explícito.
create or replace function public.registrar_medicion(
  p_etapa_id           uuid,
  p_valores            jsonb,
  p_medicion_previa_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_paciente_id        uuid;
  v_fecha_inicio       date;
  v_fecha_finalizacion date;
  v_ultima_id          uuid;
  v_momento            text;
begin
  -- 1. Resolver + lockear la etapa. for update serializa un doble registro
  --    concurrente (design §9.5).
  select et.paciente_id, et.fecha_inicio, et.fecha_finalizacion
    into v_paciente_id, v_fecha_inicio, v_fecha_finalizacion
    from public.etapas_tratamiento as et
   where et.id = p_etapa_id
     for update;

  if not found then
    raise exception 'etapa_no_encontrada' using errcode = 'P0002';
  end if;

  -- 2. Autorización: SOLO asignación activa. Sin disjunto de admin (design §1.0).
  if not public.has_active_assignment(v_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. La etapa debe haber arrancado.
  if v_fecha_inicio is null then
    raise exception 'etapa_no_iniciada' using errcode = 'P0001';
  end if;

  -- 4. La etapa no puede estar cerrada.
  if v_fecha_finalizacion is not null then
    raise exception 'etapa_cerrada' using errcode = 'P0001';
  end if;

  -- 5. Concurrencia optimista: p_medicion_previa_id debe matchear la última
  --    medición real de la etapa. `is distinct from`, no `<>`: null en ambos
  --    lados (etapa recién arrancada, sin mediciones) debe comparar igual.
  select m.id into v_ultima_id
    from public.mediciones_estructura m
   where m.etapa_id = p_etapa_id
   order by m.registrada_en desc, m.id desc
   limit 1;

  if v_ultima_id is distinct from p_medicion_previa_id then
    -- PT409, nunca 40001: PostgREST reintenta serialization_failure en loop
    -- y el cliente recibe un 504 a los ~60s (MED-007). PT409 -> HTTP 409.
    raise exception 'conflicto_medicion' using errcode = 'PT409';
  end if;

  -- 6. Validar valores contra el catálogo ACTIVO.
  perform public._validar_valores_medicion(
    p_valores,
    array(select id from public.centros_energeticos where activo order by orden)
  );

  -- 7. apertura si es la primera medición de la etapa, seguimiento si no.
  --    NUNCA cierre (RF-MED-008) — ese momento lo produce solo
  --    cerrar_etapa_con_medicion.
  v_momento := case when v_ultima_id is null then 'apertura' else 'seguimiento' end;

  return public._insertar_medicion(p_etapa_id, v_momento, p_valores);
end;
$$;

comment on function public.registrar_medicion(uuid, jsonb, uuid) is
  'Registra una lectura de estructura (apertura|seguimiento, nunca cierre) sobre una etapa arrancada y abierta. Autoriza SOLO con has_active_assignment(paciente) — sin disjunto de admin (design §1.0/DEC-31): 42501 para un admin sin asignación. p_medicion_previa_id sin default: concurrencia optimista via is distinct from, PT409 (HTTP 409) si no matchea la última medición real. Errores: etapa_no_encontrada (P0002), no_autorizado (42501), etapa_no_iniciada/etapa_cerrada (P0001), conflicto_medicion (PT409), valores_invalidos (22023).';

-- ---------------------------------------------------------------------------
-- editar_medicion
-- ---------------------------------------------------------------------------
-- Edita in-place la última medición de una etapa, si _medicion_editable
-- (design §1.2) lo permite. Sin disjunto de admin. momento NUNCA cambia.
-- El detalle por centro se actualiza en el mismo set (garantizado por
-- validar contra el set PROPIO de la medición, no el catálogo activo) — el
-- PK de medicion_valores no churnea, nunca hay delete/insert.
create or replace function public.editar_medicion(p_medicion_id uuid, p_valores jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_motivo           text;
  v_datos_anteriores jsonb;
  v_datos_nuevos     jsonb;
begin
  -- 1. La medición debe existir. for update lockea la fila para toda la
  --    transacción, incluida la evaluación de _medicion_editable.
  perform 1 from public.mediciones_estructura where id = p_medicion_id for update;

  if not found then
    raise exception 'medicion_no_encontrada' using errcode = 'P0002';
  end if;

  -- 2. La regla de 4 condiciones, una sola implementación. Sin disjunto de admin.
  v_motivo := public._medicion_editable(p_medicion_id);

  if v_motivo is not null then
    raise exception 'medicion_no_editable'
      using errcode = '42501',
            detail  = v_motivo;
  end if;

  -- 3. Validar contra el SET PROPIO de la medición (design §1.7/§8.2), NO el
  --    catálogo activo — lo que mantiene editable una medición vieja después
  --    de un cambio de catálogo.
  perform public._validar_valores_medicion(
    p_valores,
    array(select centro_id from public.medicion_valores where medicion_id = p_medicion_id)
  );

  -- 4. Capturar el estado anterior ANTES de mutar, para audit_log.
  select jsonb_build_object(
           'estructura_general', m.estructura_general,
           'valores', (
             select jsonb_agg(jsonb_build_object('centro_id', mv.centro_id, 'valor', mv.valor))
               from public.medicion_valores mv
              where mv.medicion_id = m.id
           )
         )
    into v_datos_anteriores
    from public.mediciones_estructura m
   where m.id = p_medicion_id;

  -- 5. Actualizar la cabecera. momento NUNCA cambia.
  update public.mediciones_estructura
     set estructura_general = (p_valores ->> 'estructura_general')::int,
         updated_at         = now()
   where id = p_medicion_id;

  -- 6. Actualizar el detalle in-place: el set es idéntico por el paso 3 ⇒
  --    update, nunca delete/insert.
  update public.medicion_valores mv
     set valor      = (elem ->> 'valor')::int,
         updated_at = now()
    from jsonb_array_elements(p_valores -> 'centros') as elem
   where mv.medicion_id = p_medicion_id
     and mv.centro_id   = (elem ->> 'centro_id')::uuid;

  -- 7. Rastro de auditoría. Patrón manual, sin triggers (mismo patrón que
  --    desactivar_terapeuta, 70_rpcs_terapeutas.sql:242).
  v_datos_nuevos := jsonb_build_object(
    'estructura_general', (p_valores ->> 'estructura_general')::int,
    'valores', p_valores -> 'centros'
  );

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores, datos_nuevos)
  values ('mediciones_estructura', p_medicion_id::text, 'UPDATE', auth.uid(), v_datos_anteriores, v_datos_nuevos);
end;
$$;

comment on function public.editar_medicion(uuid, jsonb) is
  'Edita in-place la última medición de una etapa cuando _medicion_editable(p_medicion_id) devuelve null. Sin disjunto de admin: 42501/medicion_no_editable con detail = motivo del enum. Valida contra el SET PROPIO de la medición (no el catálogo activo) — mantiene editable una medición vieja tras un cambio de catálogo. momento nunca cambia; el detalle se actualiza in-place (mismo set, garantizado por la validación). Audita en audit_log (patrón manual, sin triggers). Errores: medicion_no_encontrada (P0002), medicion_no_editable (42501), valores_invalidos (22023).';

-- ---------------------------------------------------------------------------
-- cerrar_etapa_con_medicion
-- ---------------------------------------------------------------------------
-- Cierre transaccional: inserta la medición de cierre Y cierra la etapa como
-- finalizada en UNA transacción. Autoriza SOLO con has_active_assignment —
-- sin disjunto de admin (design §1.0): el cierre administrativo sin
-- asignación es cerrar_etapa (71_rpcs_pacientes.sql), no esta RPC.
--
-- Resuelve la etapa activa con la MISMA query que cerrar_etapa
-- (71_rpcs_pacientes.sql:721-727) — es lo que garantiza que ambos caminos de
-- cierre targetean la misma fila.
create or replace function public.cerrar_etapa_con_medicion(
  p_paciente_id        uuid,
  p_motivo             text,
  p_valores            jsonb,
  p_medicion_previa_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_fecha_inicio date;
  v_ultima_id    uuid;
  v_estado_id    uuid;
  v_cierre_id    uuid;
begin
  -- 1. Resolver + lockear la etapa activa. Query idéntica a cerrar_etapa.
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1
     for update;

  if not found then
    raise exception 'etapa_activa_no_encontrada' using errcode = 'P0002';
  end if;

  -- 2. Autorización: SOLO asignación activa. Sin disjunto de admin.
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. La etapa debe haber arrancado.
  if v_fecha_inicio is null then
    raise exception 'etapa_no_iniciada' using errcode = 'P0001';
  end if;

  -- 4. Concurrencia optimista, idéntico criterio que registrar_medicion.
  select m.id into v_ultima_id
    from public.mediciones_estructura m
   where m.etapa_id = v_etapa_id
   order by m.registrada_en desc, m.id desc
   limit 1;

  if v_ultima_id is distinct from p_medicion_previa_id then
    -- PT409, nunca 40001: PostgREST reintenta serialization_failure en loop
    -- y el cliente recibe un 504 a los ~60s (MED-007). PT409 -> HTTP 409.
    raise exception 'conflicto_medicion' using errcode = 'PT409';
  end if;

  -- 5. Validar valores contra el catálogo activo.
  perform public._validar_valores_medicion(
    p_valores,
    array(select id from public.centros_energeticos where activo order by orden)
  );

  -- 6. Insertar la medición de cierre.
  v_cierre_id := public._insertar_medicion(v_etapa_id, 'cierre', p_valores);

  -- 7. Cerrar la etapa. Misma colapsada de motivo_cierre que cerrar_etapa
  --    (71_rpcs_pacientes.sql:769). Insert-then-close: si algo falla acá
  --    (no debería, ya validamos todo), la etapa queda abierta, no cerrada
  --    sin su lectura.
  select ee.id into v_estado_id from public.estados_etapa ee where ee.codigo = 'finalizada';

  update public.etapas_tratamiento
     set fecha_finalizacion = current_date,
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;

  return v_cierre_id;
end;
$$;

comment on function public.cerrar_etapa_con_medicion(uuid, text, jsonb, uuid) is
  'Cierre transaccional: inserta la medición de cierre y cierra la etapa como finalizada en una transacción. Autoriza SOLO con has_active_assignment(paciente) — sin disjunto de admin (design §1.0/DEC-31): el cierre administrativo sin asignación es cerrar_etapa, no esta RPC. Resuelve la etapa activa con la misma query que cerrar_etapa. Errores: etapa_activa_no_encontrada (P0002), no_autorizado (42501), etapa_no_iniciada (P0001), conflicto_medicion (PT409), valores_invalidos (22023).';

