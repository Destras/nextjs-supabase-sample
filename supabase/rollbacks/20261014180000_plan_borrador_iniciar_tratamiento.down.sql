-- Rollback de 20261014180000_plan_borrador_iniciar_tratamiento.sql:
-- recrea etapa_plan_completo y el set_entregas_plan anterior (que arrancaba
-- al completar el plan) y borra iniciar_tratamiento.

drop function public.iniciar_tratamiento(uuid, jsonb);
drop function public.set_entregas_plan(uuid, jsonb);

-- ---------------------------------------------------------------------------
-- etapa_plan_completo
-- ---------------------------------------------------------------------------
-- Helper de completitud del plan de tratamiento de una etapa.
-- Espeja la regla del front (slotDefinitions.ts + isSemanaCompleta en
-- semanaCompleteness.ts, Task 1.1 de frasesAutomaticas):
--   * Total de semanas = semanas_de_etapa(p_etapa_id) (= cantidad_niveles * 4).
--   * Una semana está completa si tiene los 2 slots persistibles: orden 1
--     (video/meditación) y orden 2 (audio/mantra) — mismo invariante que el
--     front. La frase ya NO es un slot: es derivada/automática
--     (frases_de_etapa), no se persiste vía set_entregas_plan y NO participa
--     de la completitud. Filas con orden = 3 que puedan quedar de planes
--     viejos se ignoran (no rompen ni aportan a la cuenta).
--   * El plan está completo si todas las semanas del total están completas.
--
-- Retorna false cuando no se puede resolver la modalidad (etapa inexistente).
-- Privada: la llama set_entregas_plan (security definer); sin grant a roles externos.
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
  -- Total de semanas de contenido = cantidad_niveles * 4 (4 meses × 4 semanas).
  -- Fuente única (DEC-0-2): semanas_de_etapa, que también consume
  -- frases_de_etapa. cantidad_sesiones (16/32) es metadata clínica del equipo
  -- del equipo terapéutico, NO define las semanas de contenido.
  v_total := public.semanas_de_etapa(p_etapa_id);

  if v_total is null then
    return false;
  end if;

  -- Una semana (dia_offset / 7) está completa si tiene las 5 entregas
  -- persistibles: orden 1 (video), 2 (mantra), 3 (egregor), 4 (cma), 5 (ic) —
  -- el mismo invariante de 5 slots que enforce el front (isSemanaCompleta en
  -- semanaCompleteness.ts, SLOT_DEFINITIONS en slotDefinitions.ts). La frase
  -- (auto-derivada) quedó fuera del contrato de set_entregas_plan y nunca
  -- ocupa un orden de este rango. Filtramos a (1..5) explícitamente para que
  -- filas fuera de rango que sobrevivan de planes viejos ni cuenten a favor
  -- ni rompan la cuenta.
  select count(*)
    into v_completas
    from (
      select ep.dia_offset / 7 as semana
        from public.entregas_plan as ep
       where ep.etapa_id = p_etapa_id
         and ep.orden in (1, 2, 3, 4, 5)
       group by ep.dia_offset / 7
      having count(distinct ep.orden) = 5
    ) as t;

  return v_completas = v_total;
end;
$$;

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (semanas_de_etapa) tienen los 5 slots persistibles (órdenes 1=video, 2=mantra/audio, 3=egregor, 4=cma, 5=ic). La frase es derivada/automática y no participa de la completitud. Espeja la regla de completitud del front (isSemanaCompleta en semanaCompleteness.ts) y el mapa de slots (SLOT_DEFINITIONS en slotDefinitions.ts). Privada: la invoca set_entregas_plan.';

-- Sin grant: privada (la llama set_entregas_plan, que corre como definer).
-- anon y authenticated no necesitan acceso directo.
revoke execute on function public.etapa_plan_completo(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_entregas_plan
-- ---------------------------------------------------------------------------
-- Full-replace del plan de entregas de una etapa en una transacción atómica:
--   1. Valida el mapa tipo-por-orden (DEC-8, ver bloque debajo). Corre ANTES
--      del delete: si falla, el plan guardado del terapeuta nunca se toca.
--   2. Borra todas las filas existentes de entregas_plan para la etapa.
--   3. Inserta las filas del JSONB recibido.
--   4. Si el plan quedó completo (etapa_plan_completo — el seam de slots que
--      redefine feat/frases-automaticas; su regla NUNCA se inlinea acá):
--      a. Arranca el tratamiento de forma idempotente e irreversible:
--         fecha_inicio = public.hoy(), estado 'activa', solo si la etapa
--         tenía fecha_inicio Y fecha_finalizacion en NULL (DEC-E1-2: una
--         etapa cerrada que nunca arrancó NO se resucita).
--      b. Si arrancó recién en este guardado, recomputa
--         niveles.fecha_seguimiento_esperada anclada al arranque real
--         (DEC-4). Un re-guardado sobre una etapa ya activa no re-agenda.
--      c. Devuelve el paciente_id (siempre que el plan esté completo,
--         arrancado o no — DEC-E1-1) para que el web console dispare la
--         emisión+entrega del OTP de activación (generar_otp_activacion).
--         Idempotente: si el paciente ya tiene cuenta o un OTP vigente,
--         no genera uno nuevo. El return NO se acopla al arranque: es el
--         único mecanismo de reintento del OTP que existe.
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

  -- 2. Verificar autorización: terapeuta dueño o admin. Hasta SEG-004 este
  --    guard fallaba ABIERTO sin sesión y una llamada sin login reescribía el
  --    plan de cualquier etapa.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() es lo que deja afuera a un terapeuta desactivado con el
  -- token todavía vigente, y nunca devuelve NULL (sin sesión da false). El
  -- `is not null` cierra el otro NULL: si el dueño no resuelve,
  -- `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Validación tipo-por-orden (DEC-8). El mapa de slots debe espejar
  --    SLOT_DEFINITIONS en app/controllers/Tratamiento/utils/slotDefinitions.ts
  --    y public.etapa_plan_completo (71_rpcs_pacientes.sql). Corre ANTES del
  --    delete: plpgsql hace rollback igual ante una excepción, pero fallar acá
  --    primero evita que el plan guardado del terapeuta desaparezca aunque
  --    sea momentáneamente, y cuesta un solo query en vez de
  --    delete + insert + rollback. El `case` no tiene `else`: un orden fuera
  --    de 1..5 da null, y `is distinct from` hace que null-vs-cualquier-cosa
  --    sea true → también lanza. Slots desconocidos se rechazan, no se
  --    ignoran.
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

  -- 4. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  --    ⚠️ Las filas se recrean con fecha_entregada/fecha_consumida en NULL.
  --    Hoy nadie escribe esas columnas, así que no se pierde nada (BETA-002,
  --    pulidoBeta). Antes de que algo empiece a escribirlas, este guardado
  --    tiene que dejar de ser full-replace o cada edición borra el historial.
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

  -- 5. Si el plan quedó completo para todas las semanas (DEC-E1-2), devolver el
  --    paciente_id para que el web console dispare la invitación vía la Edge
  --    Function paciente-invitacion, que entrega la bienvenida post-activación
  --    (activacionPorTelefono, Epic 3). Esa EF ya no emite OTPs: el código de
  --    activación lo pide el paciente desde la app (request-otp). El envío no
  --    ocurre acá: Postgres no puede llamar a la
  --    Meta Cloud API, así que la entrega por WhatsApp vive en ese boundary de
  --    Edge Function (DevSpec §9.2). La idempotencia (no duplicar OTP / no
  --    reentregar la bienvenida) la garantiza esa EF, no este RPC.
  if public.etapa_plan_completo(p_etapa_id) then
    -- 1. Arranque: idempotente (fecha_inicio is null) e irreversible.
    --    fecha_finalizacion is null: NO se resucita una etapa cerrada (DEC-E1-2).
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

    -- 2. Recompute de la agenda: SOLO si arrancó recién (DEC-4). Un mes de
    --    tratamiento son 28 días, no un mes calendario (ADR 0011): la
    --    evaluación del nivel n vence el día 28 * n desde el arranque.
    if v_arrancada = 1 then
      update public.niveles as n
         set fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel
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
  'Full-replace del plan de entregas de una etapa: valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 5 slots persistibles — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = public.hoy(), estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4): public.hoy() + 28 * numero_nivel (un mes de tratamiento son 28 días, ADR 0011). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la invitación (EF paciente-invitacion), que entrega la bienvenida post-activación (activacionPorTelefono Epic 3; el OTP lo pide el paciente desde la app) — el reintento depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;


revoke execute on function public.set_entregas_plan(uuid, jsonb) from public, anon;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: solo usuarios de consola (is_console_user(); cualquier otro recibe no_autorizado, 42501): el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. El destino debe existir en terapeutas (terapeuta_inexistente, P0002). Devuelve el uuid del paciente creado. Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

comment on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';

comment on function public.semanas_de_etapa(uuid) is
  'Total de semanas de contenido de una etapa: cantidad_niveles de su modalidad × 4. Null si la etapa no existe. Fuente única de "cuánto dura un tratamiento" (DEC-0-2); la consumen etapa_plan_completo y frases_de_etapa. Privada: la invocan RPCs security definer.';
