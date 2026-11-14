-- planBorrador / Task 0.1: guardar el plan nunca arranca el tratamiento;
-- iniciar_tratamiento es el acto explícito que lo arranca. etapa_plan_completo
-- desaparece (el plan ya no tiene noción de "completo").
--
-- set_entregas_plan cambia el tipo de retorno (uuid -> void): hay que dropear
-- y recrear, y volver a otorgar EXECUTE (las funciones nacen sin él).

-- Primero set_entregas_plan (la versión vieja llamaba a etapa_plan_completo).
drop function public.set_entregas_plan(uuid, jsonb);
drop function public.etapa_plan_completo(uuid);

-- ---------------------------------------------------------------------------
-- set_entregas_plan
-- ---------------------------------------------------------------------------
-- Guarda el plan de entregas de una etapa (full-replace) en una transacción
-- atómica. GUARDAR NUNCA ARRANCA EL TRATAMIENTO (planBorrador, D-1): acepta
-- cualquier plan, incluso vacío o parcial, y no toca fecha_inicio, estado ni
-- niveles. El arranque es un acto propio: public.iniciar_tratamiento.
--   1. Resuelve la etapa con lock (etapa_inexistente) y verifica "admin o dueño".
--   2. Rechaza una etapa cerrada (etapa_cerrada, P0001 — DEC-04).
--   3. Valida el mapa tipo-por-orden (DEC-8). Corre ANTES del delete: si falla,
--      el plan guardado del terapeuta nunca se toca.
--   4. Borra todas las filas existentes de entregas_plan para la etapa e
--      inserta las del JSONB recibido.
--   Devuelve void. (DEC-01: un panel viejo en caché que lee `data` como
--   pacienteId recibe null, igual que hoy con un plan incompleto.)
--
-- El JSONB debe ser un array de objetos con:
--   semana       integer  (1-based; dia_offset = (semana - 1) * 7)
--   orden        integer
--   contenido_id text     (uuid | '' | null)
--
-- contenido_id es obligatorio (entregas_plan.contenido_id not null,
-- frasesAutomaticas/Task 4.1): un item sin contenido_id aborta la transacción
-- entera por violación de esa constraint. La frase ya no es un slot que este
-- RPC persista — es derivada/automática (frases_de_etapa).
--
-- Acceso: el terapeuta dueño de la etapa (etapas_tratamiento.terapeuta_id)
-- o un admin. Escritura exclusivamente via security definer; la RLS de
-- entregas_plan permanece select-only.
-- ---------------------------------------------------------------------------

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id      uuid;
  v_fecha_finalizacion date;
begin
  -- 1. Resolver la etapa (con lock, para serializar contra un cierre o un
  --    inicio simultáneo) y obtener el terapeuta dueño.
  select e.terapeuta_id, e.fecha_finalizacion
    into v_terapeuta_id, v_fecha_finalizacion
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id
     for update;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() deja afuera a un terapeuta desactivado con el token
  -- todavía vigente y nunca devuelve NULL. El `is not null` cierra el otro
  -- NULL: si el dueño no resuelve, `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Una etapa cerrada no se edita (DEC-04).
  if v_fecha_finalizacion is not null then
    raise exception 'etapa_cerrada' using errcode = 'P0001';
  end if;

  -- 4. Validación tipo-por-orden (DEC-8). El mapa de slots debe espejar
  --    SLOT_DEFINITIONS en app/controllers/Tratamiento/utils/slotDefinitions.ts.
  --    Corre ANTES del delete para no tocar el plan guardado si falla. El
  --    `case` no tiene `else`: un orden fuera de 1..5 da null, y
  --    `is distinct from` hace que null-vs-cualquier-cosa sea true → también
  --    lanza. Slots desconocidos se rechazan, no se ignoran.
  if exists (
    select 1
      from jsonb_array_elements(p_entregas_plan) as item
      join public.contenidos as c
        on c.id = nullif(item ->> 'contenido_id', '')::uuid
     where c.tipo is distinct from (
             case (item ->> 'orden')::int
               when 1 then 'video'
               when 2 then 'audio'
               when 3 then 'egregor'
               when 4 then 'cma'
               when 5 then 'ic'
             end
           )
  ) then
    raise exception 'tipo_slot_invalido' using errcode = '23514';
  end if;

  -- 5. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  --    ⚠️ Las filas se recrean con fecha_entregada/fecha_consumida en NULL.
  --    Hoy nadie escribe esas columnas, así que no se pierde nada (BETA-002,
  --    pulidoBeta). El bloqueo de semanas pasadas lo agrega
  --    epic-1-asignar-contenido (Task 1.1); acá todavía es full-replace.
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
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Guarda el plan de entregas de una etapa (full-replace) y NUNCA arranca el tratamiento (planBorrador, D-1): acepta cualquier plan, incluso vacío o parcial, y no toca fecha_inicio, estado ni niveles; el arranque es public.iniciar_tratamiento. Valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Lanza etapa_inexistente (P0002) y etapa_cerrada (P0001) si la etapa ya terminó. Devuelve void. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
revoke execute on function public.set_entregas_plan(uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- iniciar_tratamiento
-- ---------------------------------------------------------------------------
-- Acto explícito del terapeuta (o un admin) que arranca el tratamiento de una
-- etapa (planBorrador, D-3). No depende del contenido cargado: arranca con el
-- plan vacío. Una sola vez: una segunda llamada devuelve iniciado = false y
-- no cambia la fecha.
--   1. Resuelve la etapa con lock de fila (DEC-03: serializa dos inicios
--      simultáneos; el segundo espera y ve fecha_inicio ya seteada).
--   2. Guard "admin o dueño" NULL-safe.
--   3. etapa_cerrada / paciente_dado_de_baja (P0001).
--   4. Si llega p_entregas_plan, lo guarda con set_entregas_plan (DEC-02: las
--      reglas de guardado viven en un solo lugar; misma transacción, así que
--      un tipo_slot_invalido aborta también el arranque).
--   5. Arranca: fecha_inicio = public.hoy(), estado 'activa', solo si
--      fecha_inicio y fecha_finalizacion son NULL.
--   6. Si arrancó recién, agenda niveles.fecha_seguimiento_esperada =
--      public.hoy() + 28 * numero_nivel (ADR 0011; DEC-4 de inicioTratamiento).
--   Devuelve { iniciado: boolean, pacienteId: uuid }.
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_tratamiento(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id       uuid;
  v_paciente_id        uuid;
  v_fecha_finalizacion date;
  v_estado_paciente    text;
  v_estado_activa      uuid;
  v_arrancada          integer;
begin
  -- 1. Resolver la etapa con lock de fila (DEC-03).
  select et.terapeuta_id, et.paciente_id, et.fecha_finalizacion, ep.codigo
    into v_terapeuta_id, v_paciente_id, v_fecha_finalizacion, v_estado_paciente
    from public.etapas_tratamiento as et
    join public.pacientes as p on p.id = et.paciente_id
    left join public.estados_paciente as ep on ep.id = p.estado_id
   where et.id = p_etapa_id
     for update of et;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Guard "admin o dueño" (idéntico a set_entregas_plan, NULL-safe).
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Una etapa cerrada o un paciente que borró su cuenta no se inician.
  if v_fecha_finalizacion is not null then
    raise exception 'etapa_cerrada' using errcode = 'P0001';
  end if;

  if v_estado_paciente = 'baja_voluntaria' then
    raise exception 'paciente_dado_de_baja' using errcode = 'P0001';
  end if;

  -- 4. Guardar el plan en la misma transacción (DEC-02).
  if p_entregas_plan is not null then
    perform public.set_entregas_plan(p_etapa_id, p_entregas_plan);
  end if;

  -- 5. Arranque: idempotente (fecha_inicio is null) e irreversible.
  select ee.id into v_estado_activa
    from public.estados_etapa as ee
   where ee.codigo = 'activa';

  update public.etapas_tratamiento
     set fecha_inicio = public.hoy(),
         estado_id    = v_estado_activa
   where id = p_etapa_id
     and fecha_inicio is null
     and fecha_finalizacion is null;

  get diagnostics v_arrancada = row_count;

  -- 6. Agenda de evaluaciones: SOLO si arrancó recién. Un mes de tratamiento
  --    son 28 días, no un mes calendario (ADR 0011).
  if v_arrancada = 1 then
    update public.niveles as n
       set fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel
     where n.etapa_id = p_etapa_id;
  end if;

  return jsonb_build_object('iniciado', v_arrancada = 1, 'pacienteId', v_paciente_id);
end;
$$;

comment on function public.iniciar_tratamiento(uuid, jsonb) is
  'Arranca el tratamiento de una etapa (planBorrador, D-3): fecha_inicio = public.hoy(), estado ''activa'' y agenda de niveles (fecha_seguimiento_esperada = hoy() + 28 * numero_nivel, ADR 0011). No depende del contenido: arranca con el plan vacío. Si p_entregas_plan no es null lo guarda antes con set_entregas_plan en la misma transacción (un fallo aborta ambas cosas). Idempotente y serializada por lock de fila: una segunda llamada devuelve iniciado=false y no cambia la fecha. Devuelve {iniciado, pacienteId}. Lanza etapa_inexistente (P0002), no_autorizado (42501), etapa_cerrada y paciente_dado_de_baja (P0001). Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.iniciar_tratamiento(uuid, jsonb) to authenticated;
revoke execute on function public.iniciar_tratamiento(uuid, jsonb) from public, anon;


-- Comentarios que hablaban del plan completo (los `comment on` no los trackea
-- el diff declarativo).
comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca con iniciar_tratamiento. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: solo usuarios de consola (is_console_user(); cualquier otro recibe no_autorizado, 42501): el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. El destino debe existir en terapeutas (terapeuta_inexistente, P0002). Devuelve el uuid del paciente creado. Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

comment on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca con iniciar_tratamiento. Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';

comment on function public.semanas_de_etapa(uuid) is
  'Total de semanas de contenido de una etapa: cantidad_niveles de su modalidad × 4. Null si la etapa no existe. Fuente única de "cuánto dura un tratamiento" (DEC-0-2); la consume frases_de_etapa. Privada: la invoca un RPC security definer.';
