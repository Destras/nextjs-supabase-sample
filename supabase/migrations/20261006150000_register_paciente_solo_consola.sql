-- =============================================================================
-- seguridadPanel / SEG-004 — Los RPC de escritura rechazan por autorización
-- =============================================================================
-- Dos guards dejaban pasar a quien no debían y la escritura la frenaba (o no)
-- otra cosa:
--
--   1. register_paciente: con p_terapeuta_id nulo resolvía el terapeuta a
--      auth.uid() y después comparaba auth.uid() consigo mismo. Un paciente (o
--      cualquier sesión) pasaba la autorización; lo frenaba recién el FK
--      asignaciones_paciente_terapeuta_id_fkey, por accidente.
--      Ahora lo primero que hace es exigir public.is_console_user(), y antes de
--      insertar verifica que el terapeuta destino exista en terapeutas
--      (terapeuta_inexistente, P0002) en vez de dejar salir el 23503 crudo.
--
--   2. set_entregas_plan: `not (is_admin() or auth.uid() = v_terapeuta_id)`.
--      Sin usuario, la comparación da NULL, `not NULL` da NULL y el `if` no
--      entra: el guard fallaba ABIERTO. Una llamada sin sesión (la función es
--      ejecutable por anon hasta SEG-005) reescribía el plan de cualquier etapa.
--      Ahora la comparación es NULL-safe.
--
-- El resto de los RPC de escritura ejecutables por authenticated se revisó y
-- corta bien (is_admin(), has_active_assignment() —un exists, nunca NULL—, o
-- una comparación ya NULL-safe contra el terapeuta de la asignación/etapa).
--
-- Las dos funciones se recrean partiendo de su cuerpo actual: misma firma,
-- security definer, search_path, comment (el de register_paciente suma el
-- requisito nuevo) y grants.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

create or replace function public.register_paciente(
  p_nombre            text,
  p_fecha_nacimiento  date,
  p_email             text,
  p_telefono          text,
  p_causa_id          uuid,
  p_algoritmo_id      uuid,
  p_modalidad_id      uuid,
  p_bloqueo_ids       uuid[],
  p_alfabetos         jsonb,
  p_terapeuta_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_pac_activo    uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_paciente_id          uuid;
  v_etapa_id             uuid;
begin
  -- 0. Solo un usuario de consola (terapeuta o admin) registra pacientes
  --    (seguridadPanel / SEG-004). Va primero y aparte porque el guard de
  --    abajo, con p_terapeuta_id nulo, compara auth.uid() consigo mismo: un
  --    paciente lo pasaba y lo frenaba recién el FK de asignaciones_paciente.
  --    coalesce: sin sesión, is_console_user() ya da false; el coalesce deja
  --    escrito que un NULL también rechaza.
  if not coalesce(public.is_console_user(), false) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 1. Resolver terapeuta y validar autorización.
  --    Un terapeuta solo puede registrar pacientes para sí mismo.
  --    Un admin puede registrar para cualquier terapeuta.
  v_terapeuta_id := coalesce(p_terapeuta_id, auth.uid());

  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 1b. El destino tiene que ser un terapeuta (seguridadPanel / SEG-004): un
  --     admin que pasa un id que no lo es —o un admin sin fila en terapeutas
  --     que no pasa ninguno— recibe un error legible en vez del 23503 crudo
  --     de asignaciones_paciente_terapeuta_id_fkey.
  if not exists (
    select 1
      from public.terapeutas as t
     where t.id = v_terapeuta_id
  ) then
    raise exception 'terapeuta_inexistente'
      using errcode = 'P0002',
            detail  = 'el terapeuta destino no existe en terapeutas';
  end if;

  -- 2. Resolver ids de estado por slug (slugs verificados en seed.sql:181-187).
  select ep.id into v_estado_pac_activo
    from public.estados_paciente as ep
   where ep.codigo = 'activo';

  if not found then
    raise exception 'estado_paciente_activo_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- inicioTratamiento: la etapa nace 'pendiente' (sin arrancar), no 'activa'.
  -- El slug lo garantiza el insert idempotente del schema declarativo
  -- (inicioTratamiento Epic 0, Task 0.1), no el seed.
  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- 3. Resolver cantidad_niveles de la modalidad (pre-chequeo explícito para
  --    un error descriptivo en lugar de una violación de FK genérica).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 4. Inserts en orden dentro de la transacción implícita de la función.

  -- 4a. Paciente base.
  --     Fecha de nacimiento obligatoria (activacionPorTelefono, Epic 2 Task 2.1):
  --     es el segundo factor del canje del OTP en la app móvil (junto al
  --     código); una ficha sin fecha nunca puede activarse.
  if p_fecha_nacimiento is null then
    raise exception 'fecha_nacimiento_requerida' using errcode = '23502';
  end if;

  --     Email es obligatorio (DEC-E3-2): fallar rápido antes de cualquier insert.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  -- Teléfono obligatorio (activacionPorTelefono, DEC-05): una ficha sin
  -- teléfono nunca puede pedir ni recibir el código de activación. Mismo
  -- patrón que email_requerido; la normalización a la forma canónica la hace
  -- el trigger normalizar_telefono_pacientes (21_pacientes.sql), no acá.
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    raise exception 'telefono_requerido' using errcode = '23502';
  end if;

  -- baja-voluntaria-cuenta-paciente (Fase 1, ADR-3): si el email pertenece a
  -- un paciente que ya se dio de baja voluntariamente, lanzar un error
  -- legible en vez de dejar que el insert de abajo falle con el 23505 crudo
  -- de pacientes_email_key. Comparación exacta (= btrim(p_email)), NO lower():
  -- debe ser co-extensiva con el índice único, o este guard dispararía para
  -- un email que en los hechos hubiera insertado con éxito. No habilita
  -- re-alta (fuera de alcance) — solo hace legible el fallo.
  if exists (
    select 1
      from public.pacientes as p
      join public.estados_paciente as ep on ep.id = p.estado_id
     where p.email = btrim(p_email)
       and ep.codigo = 'baja_voluntaria'
  ) then
    raise exception 'paciente_dado_de_baja'
      using errcode = 'P0001',
            detail  = 'El email pertenece a un paciente que se dio de baja; la re-alta no está soportada';
  end if;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, fecha_alta)
  values (
    btrim(p_nombre),
    p_fecha_nacimiento,
    btrim(p_email),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    v_estado_pac_activo,
    public.hoy()
  )
  returning id into v_paciente_id;

  -- 4b. Asignación terapeuta-paciente (fecha_hasta NULL = activa).
  --     asignado_por = auth.uid() siempre: el caller queda auditado,
  --     incluso si es un admin asignando a otro terapeuta.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por)
  values (v_paciente_id, v_terapeuta_id, public.hoy(), auth.uid());

  -- 4c. Etapa de tratamiento inicial (fecha_finalizacion NULL = en curso).
  --     inicioTratamiento: fecha_inicio NULL + estado 'pendiente' — la etapa
  --     se crea SIN ARRANCAR. Arranca cuando set_entregas_plan completa el
  --     plan de contenido (Task 1.2), no en el alta.
  insert into public.etapas_tratamiento (
    paciente_id,
    terapeuta_id,
    causa_id,
    algoritmo_id,
    modalidad_id,
    fecha_inicio,
    estado_id
  )
  values (
    v_paciente_id,
    v_terapeuta_id,
    p_causa_id,
    p_algoritmo_id,
    p_modalidad_id,
    null,
    v_estado_eta_pendiente
  )
  returning id into v_etapa_id;

  -- 4d. Bloqueos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 4e. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío ('[]')
  --     genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 4f. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla de N niveles se crea igual (invariante
  --     "toda etapa tiene su grilla"), pero SIN fecha_seguimiento_esperada —
  --     la etapa todavía no arrancó, no hay fecha_inicio contra la cual
  --     anclar la agenda. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: solo usuarios de consola (is_console_user(); cualquier otro recibe no_autorizado, 42501): el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. El destino debe existir en terapeutas (terapeuta_inexistente, P0002). Devuelve el uuid del paciente creado. Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

grant execute on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) to authenticated;

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
  --    Comparación NULL-safe (seguridadPanel / SEG-004): sin usuario,
  --    `auth.uid() = v_terapeuta_id` da NULL, `not (false or NULL)` da NULL y
  --    el `if` no entraba: el guard fallaba ABIERTO y una llamada sin sesión
  --    reescribía el plan de cualquier etapa. El `is not null` lo cierra.
  if not (
    public.is_admin()
    or (auth.uid() is not null and auth.uid() = v_terapeuta_id)
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
