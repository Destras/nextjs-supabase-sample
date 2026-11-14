-- ---------------------------------------------------------------------------
-- register_paciente
-- ---------------------------------------------------------------------------
-- Crea un paciente completo en una única transacción atómica:
--   1 fila en pacientes
--   1 fila en asignaciones_paciente (fecha_hasta NULL)
--   1 fila en etapas_tratamiento (fecha_finalizacion NULL)
--   N filas en niveles (numero_nivel 1..cantidad_niveles de la modalidad)
--   M filas en etapa_bloqueos (M = cardinality de p_bloqueo_ids)
--   K filas en etapa_alfabetos (K = cardinality de p_alfabetos)
--
-- public.hoy() se establece server-side para evitar drift de timezone
-- con el cliente (decisión F del PLAN.md).
--
-- auth.uid() se usa para asignado_por independientemente de quién sea
-- v_terapeuta_id: si un admin asigna a otro terapeuta, el admin queda
-- registrado como quien realizó la asignación.
--
-- Slugs consumidos:
--   estados_paciente.codigo = 'activo'      (seed.sql:181)
--   estados_etapa.codigo    = 'pendiente'   (inicioTratamiento Epic 0, insert
--                                            idempotente en el schema declarativo,
--                                            NO en el seed)
-- Si alguien edita el seed/schema y cambia estos slugs, la función lanzará
-- estado_paciente_activo_no_encontrado / estado_etapa_pendiente_no_encontrado.
--
-- inicioTratamiento (Epic 1, Task 1.1): la etapa se crea SIN ARRANCAR
-- (fecha_inicio NULL, estado 'pendiente'). El reloj clínico arranca recién
-- cuando el terapeuta ejecuta iniciar_tratamiento, no en el alta. Los niveles
-- se siguen creando (invariante "toda etapa tiene su grilla de N niveles"), pero sin fecha_seguimiento_esperada:
-- se agendan cuando la etapa arranque.
-- ---------------------------------------------------------------------------

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
  --     se crea SIN ARRANCAR. Arranca con iniciar_tratamiento, no en el
  --     alta.
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
         (item ->> 'numero')::smallint
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
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca con iniciar_tratamiento. p_alfabetos es un jsonb array con una entrada {alfabeto_id, numero} por número; el rango lo valida el trigger validar_numero_alfabeto. Acceso: solo usuarios de consola (is_console_user(); cualquier otro recibe no_autorizado, 42501): el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. El destino debe existir en terapeutas (terapeuta_inexistente, P0002). Devuelve el uuid del paciente creado. Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

grant execute on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_paciente_identidad
-- ---------------------------------------------------------------------------
-- Corrige in-place los datos de identidad de un paciente
-- (nombre, fecha de nacimiento, email, teléfono). Estos viven en la tabla
-- pacientes y son SIEMPRE editables: no dependen del progreso del tratamiento.
--
-- Authz: el terapeuta de la asignación activa del paciente
-- (asignaciones_paciente.fecha_hasta IS NULL) o un admin. Resolvemos el
-- terapeuta dueño desde la asignación activa porque la tabla pacientes no
-- tiene terapeuta directo.
--
-- Normalización idéntica a register_paciente: btrim del nombre, y los campos
-- opcionales se colapsan a NULL cuando quedan vacíos tras el trim.
--
-- Excepción al "siempre editables": el email queda bloqueado cuando el paciente
-- ya activó su cuenta (user_id no nulo) — ver email_bloqueado_por_cuenta abajo.
-- ---------------------------------------------------------------------------

create or replace function public.update_paciente_identidad(
  p_paciente_id          uuid,
  p_nombre               text,
  p_fecha_nacimiento     date,
  p_email                text,
  p_telefono             text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  -- 1. Resolver el terapeuta dueño y autorizar. Preferimos la asignación
  --    activa; si no hay (hueco de datos), caemos a la etapa activa, igual que
  --    update_etapa_diagnostico, para no bloquear datos siempre editables.
  --    order by coalesce(fecha_inicio, created_at) desc (no fecha_inicio desc
  --    a secas): en Postgres `desc` es NULLS FIRST, así que una etapa sin
  --    arrancar (fecha_inicio null) flotaría al tope aunque no sea la más
  --    reciente. Solo importa si hubiera >1 etapa abierta (anomalía de datos;
  --    el gate duro de iniciar_nueva_etapa la previene), pero determinístico
  --    de verdad es barato.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
       and et.fecha_finalizacion is null
     order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
     limit 1;
  end if;

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

  -- 2. Actualizar identidad in-place (sin gate de progreso).
  --     Fecha de nacimiento obligatoria (activacionPorTelefono, Epic 2 Task 2.1):
  --     es el segundo factor del canje de OTP; una ficha sin fecha nunca puede
  --     activarse.
  if p_fecha_nacimiento is null then
    raise exception 'fecha_nacimiento_requerida' using errcode = '23502';
  end if;

  --     Email es obligatorio (DEC-E3-2): fallar antes del update.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  -- Teléfono obligatorio (activacionPorTelefono, DEC-05): mismo patrón que
  -- email_requerido; la normalización a la forma canónica la hace el trigger
  -- normalizar_telefono_pacientes (21_pacientes.sql), no acá.
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    raise exception 'telefono_requerido' using errcode = '23502';
  end if;

  -- Email bloqueado una vez activada la cuenta (pulidoBeta, BETA-030): el email
  -- de la ficha llega a auth.users una sola vez, al activar. Cambiarlo acá
  -- después dejaría la ficha con un email y el login con otro, sin avisarle a
  -- nadie, así que con user_id vinculado se rechaza. La comparación sigue la
  -- regla de "Email de la ficha" (CONTEXT.md): mayúsculas y espacios no cuentan,
  -- así que reenviar el mismo email no falla y el resto de los datos se guarda.
  if exists (
    select 1
      from public.pacientes as p
     where p.id = p_paciente_id
       and p.user_id is not null
       and lower(btrim(p.email)) is distinct from lower(btrim(p_email))
  ) then
    raise exception 'email_bloqueado_por_cuenta' using errcode = 'P0001';
  end if;

  -- Con cuenta, el email guardado se conserva tal cual: lo que llega es, a lo
  -- sumo, una variante de mayúsculas/espacios del mismo email, y no debe
  -- pisarlo. El `case` lee user_id de la misma fila que escribe, así que también
  -- cubre una activación que entre justo entre el guard de arriba y este update.
  update public.pacientes as p
     set nombre           = btrim(p_nombre),
         fecha_nacimiento = p_fecha_nacimiento,
         email            = case
                              when p.user_id is not null then p.email
                              else btrim(p_email)
                            end,
         telefono         = nullif(btrim(coalesce(p_telefono, '')), '')
   where p.id = p_paciente_id;

  if not found then
    raise exception 'paciente_inexistente'
      using errcode = 'P0002',
            detail  = 'p_paciente_id no coincide con ningún paciente';
  end if;
end;
$$;

comment on function public.update_paciente_identidad(uuid, text, date, text, text) is
  'Corrige la identidad de un paciente in-place. Acceso: terapeuta de la asignación activa o admin. Siempre editable (sin gate de progreso). Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza email_bloqueado_por_cuenta (P0001) si el paciente ya activó su cuenta (user_id no nulo) y p_email difiere del email de la ficha, sin contar mayúsculas ni espacios (pulidoBeta, BETA-030); con cuenta, el email guardado nunca se reescribe.';

grant execute on function public.update_paciente_identidad(uuid, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_etapa_diagnostico
-- ---------------------------------------------------------------------------
-- Corrige in-place el diagnóstico + plan de la etapa de tratamiento ACTIVA de
-- un paciente (causa, algoritmo, modalidad, bloqueos, alfabetos). Es una
-- corrección de error de carga, NO un re-diagnóstico.
--
-- Authz: el terapeuta de la etapa activa (etapas_tratamiento.terapeuta_id) o
-- un admin.
--
-- GATE DE FRESCURA (autoritativo, server-side): solo se permite corregir
-- mientras la etapa no tenga progreso. Una etapa está "fresca" si ninguno de
-- sus niveles tiene fecha_seguimiento_real y no existe ninguna evaluación
-- (nivel_evaluacion) colgando de esos niveles. Si ya arrancó, corregir el
-- diagnóstico sería un re-diagnóstico (otro flujo), no esta edición.
--
-- Cambiar la modalidad regenera la grilla de niveles (la modalidad define
-- cantidad_niveles). Es seguro precisamente porque el gate garantiza que no
-- hay progreso ni evaluaciones que destruir.
-- ---------------------------------------------------------------------------

create or replace function public.update_etapa_diagnostico(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabetos    jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id           uuid;
  v_terapeuta_id       uuid;
  v_modalidad_anterior uuid;
  v_cantidad_niveles   integer;
  v_fecha_inicio       date;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  -- coalesce(fecha_inicio, created_at) desc, no fecha_inicio desc a secas:
  -- en Postgres `desc` es NULLS FIRST, y una etapa sin arrancar (fecha_inicio
  -- null) no debe flotar al tope solo por eso.
  select et.id, et.terapeuta_id, et.modalidad_id, et.fecha_inicio
    into v_etapa_id, v_terapeuta_id, v_modalidad_anterior, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Autorizar contra el terapeuta dueño de la etapa.
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

  -- 3. Gate de frescura: bloquear si la etapa ya tiene progreso.
  if exists (
        select 1
          from public.niveles as n
         where n.etapa_id = v_etapa_id
           and n.fecha_seguimiento_real is not null
      )
     or exists (
        select 1
          from public.nivel_evaluacion as ne
          join public.niveles as n on n.id = ne.nivel_id
         where n.etapa_id = v_etapa_id
      )
     or exists (
        select 1
          from public.entregas_plan as ep
         where ep.etapa_id = v_etapa_id
           and ep.fecha_entregada is not null
      ) then
    raise exception 'etapa_con_progreso'
      using errcode = 'P0001',
            detail  = 'la etapa ya tiene progreso (niveles cursados o evaluaciones); corregir el diagnóstico requiere un re-diagnóstico, no esta edición';
  end if;

  -- 4. Pre-chequear la modalidad para un error descriptivo y obtener su
  --    cantidad_niveles (necesaria si hay que regenerar la grilla).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 5. Actualizar el snapshot de diagnóstico de la etapa.
  update public.etapas_tratamiento
     set causa_id     = p_causa_id,
         algoritmo_id = p_algoritmo_id,
         modalidad_id = p_modalidad_id
   where id = v_etapa_id;

  -- 6. Reemplazar bloqueos (delete + bulk insert; array vacío/NULL = 0 filas).
  delete from public.etapa_bloqueos where etapa_id = v_etapa_id;
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 7. Reemplazar alfabetos (delete + bulk insert via jsonb_array_elements;
  --    jsonb vacío ('[]') genera 0 filas, igual que bloqueos).
  delete from public.etapa_alfabetos where etapa_id = v_etapa_id;
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         (item ->> 'numero')::smallint
    from jsonb_array_elements(p_alfabetos) as item;

  -- 8. Regenerar niveles SOLO si cambió la modalidad. Seguro por el gate.
  --    Fechas ancladas a v_fecha_inicio (fecha real de la etapa), NO a public.hoy(),
  --    porque la etapa ya existe y tiene su propia fecha de inicio (DEC-0-4).
  --    Un mes de tratamiento son 28 días, no un mes calendario (ADR 0011):
  --    la evaluación del nivel n vence en fecha_inicio + 28 * n.
  if v_modalidad_anterior is distinct from p_modalidad_id then
    delete from public.niveles where etapa_id = v_etapa_id;
    insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
    select v_etapa_id, g.n, v_fecha_inicio + 28 * g.n
      from generate_series(1, v_cantidad_niveles) as g(n);
  end if;
end;
$$;

comment on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Corrige el diagnóstico/plan de la etapa activa in-place (causa, algoritmo, modalidad, bloqueos, alfabetos). p_alfabetos es un jsonb array con una entrada {alfabeto_id, numero} por número; el rango lo valida el trigger validar_numero_alfabeto. Acceso: terapeuta de la etapa o admin. Gate de frescura: solo si la etapa no tiene progreso. Cambiar modalidad regenera la grilla de niveles (fecha_seguimiento_esperada = fecha_inicio + 28 * numero_nivel: un mes de tratamiento son 28 días, ADR 0011).';

grant execute on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- set_etapa_alfabetos
-- ---------------------------------------------------------------------------
-- Reemplaza los alfabetos de la etapa ACTIVA de un paciente (full-replace).
-- A diferencia de update_etapa_diagnostico, NO tiene gate de frescura: los
-- alfabetos no cambian el tratamiento (no regeneran niveles ni tocan causa,
-- algoritmo, modalidad o bloqueos), así que se pueden corregir con el
-- tratamiento ya avanzado (CONTEXT.md, Alfabeto; ADR 0015).
--
-- Authz: el terapeuta de la etapa activa o un admin (guard SEG-008).
--
-- Concurrencia (DEC-06): la etapa se resuelve con `for update of et`, así dos
-- guardados simultáneos (terapeuta y admin) se serializan: gana el último y no
-- hay choque de PK por inserts intercalados.
--
-- p_alfabetos: jsonb array de {alfabeto_id, numero}; '[]' o null = sin alfabetos.
-- El trigger validar_numero_alfabeto valida el rango y la PK los repetidos;
-- cualquier error aborta la función y revierte el delete.
-- ---------------------------------------------------------------------------

create or replace function public.set_etapa_alfabetos(
  p_paciente_id uuid,
  p_alfabetos   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_terapeuta_id uuid;
begin
  -- 1. Resolver y bloquear la etapa activa (mismo orden determinístico que
  --    update_etapa_diagnostico).
  select et.id, et.terapeuta_id
    into v_etapa_id, v_terapeuta_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1
     for update of et;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Guard "admin o dueño" (SEG-008), NULL-safe: ver update_etapa_diagnostico.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Sin gate de frescura (ver cabecera).

  -- 4. Reemplazar alfabetos.
  delete from public.etapa_alfabetos where etapa_id = v_etapa_id;
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         (item ->> 'numero')::smallint
    from jsonb_array_elements(coalesce(p_alfabetos, '[]'::jsonb)) as item;
end;
$$;

comment on function public.set_etapa_alfabetos(uuid, jsonb) is
  'Reemplaza los alfabetos de la etapa activa de un paciente. p_alfabetos es un jsonb array con una entrada {alfabeto_id, numero} por número ([] o null = ninguno); el rango lo valida el trigger validar_numero_alfabeto. Acceso: terapeuta de la etapa o admin. Sin gate de frescura: los alfabetos no cambian el tratamiento (ADR 0015). La etapa se bloquea con for update para serializar guardados simultáneos.';

revoke execute on function public.set_etapa_alfabetos(uuid, jsonb) from public, anon;
grant execute on function public.set_etapa_alfabetos(uuid, jsonb) to authenticated;

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
--   4. Bloqueo de semanas pasadas (planBorrador, D-2, DEC-08): con el
--      tratamiento iniciado, la semana en curso es
--      floor((hoy() - fecha_inicio) / 7) + 1 (sin tope; sin fecha_inicio es 1
--      y nada es pasado). Las semanas < semana en curso del payload deben ser
--      idénticas a las guardadas, como conjuntos (semana, orden, contenido_id);
--      si no, lanza semana_pasada (P0001) con detail = la primera semana que
--      difiere. Corre antes de borrar: el plan queda intacto.
--   5. Borra las filas de la semana en curso en adelante e inserta las del
--      JSONB con semana >= semana en curso. Las filas de semanas pasadas no se
--      recrean: conservan id, fecha_entregada y fecha_consumida.
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
  v_terapeuta_id       uuid;
  v_fecha_finalizacion date;
  v_fecha_inicio       date;
  v_semana_en_curso    int;
  v_semana_pasada      int;
begin
  -- 1. Resolver la etapa (con lock, para serializar contra un cierre o un
  --    inicio simultáneo) y obtener el terapeuta dueño.
  select e.terapeuta_id, e.fecha_finalizacion, e.fecha_inicio
    into v_terapeuta_id, v_fecha_finalizacion, v_fecha_inicio
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

  -- 5. Bloqueo de semanas pasadas (D-2). Sin fecha_inicio nada es pasado.
  if v_fecha_inicio is null then
    v_semana_en_curso := 1;
  else
    v_semana_en_curso := floor((public.hoy() - v_fecha_inicio)::numeric / 7)::int + 1;
  end if;

  with payload as (
    -- Ítems del payload que caen en semanas ya pasadas.
    select (item ->> 'semana')::int as semana,
           (item ->> 'orden')::int as orden,
           nullif(item ->> 'contenido_id', '')::uuid as contenido_id
      from jsonb_array_elements(p_entregas_plan) as item
     where (item ->> 'semana')::int < v_semana_en_curso
  ),
  guardado as (
    -- Lo que la etapa tiene guardado en semanas ya pasadas.
    select (ep.dia_offset / 7 + 1) as semana, ep.orden, ep.contenido_id
      from public.entregas_plan as ep
     where ep.etapa_id = p_etapa_id
       and (ep.dia_offset / 7 + 1) < v_semana_en_curso
  )
  select min(coalesce(p.semana, g.semana))
    into v_semana_pasada
    from payload as p
    full join guardado as g
      on g.semana = p.semana
     and g.orden = p.orden
     and g.contenido_id is not distinct from p.contenido_id
   where p.semana is null or g.semana is null;

  if v_semana_pasada is not null then
    raise exception 'semana_pasada' using errcode = 'P0001', detail = v_semana_pasada::text;
  end if;

  -- 6. Reemplazo de la semana en curso en adelante. Todo ocurre en la
  --    transacción implícita de la función → atómico. Las filas de semanas
  --    pasadas no se tocan (conservan id, fecha_entregada, fecha_consumida).
  delete from public.entregas_plan
   where etapa_id = p_etapa_id
     and dia_offset >= (v_semana_en_curso - 1) * 7;

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item
  where (item ->> 'semana')::int >= v_semana_en_curso;
  -- contenido_id not null valida cada fila; un item sin contenido_id
  -- aborta la transacción entera.
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Guarda el plan de entregas de una etapa (full-replace) y NUNCA arranca el tratamiento (planBorrador, D-1): acepta cualquier plan, incluso vacío o parcial, y no toca fecha_inicio, estado ni niveles; el arranque es public.iniciar_tratamiento. Valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego, con el tratamiento iniciado, exige que las semanas pasadas (anteriores a floor((hoy() - fecha_inicio) / 7) + 1, con public.hoy()) del payload coincidan con lo guardado — si no, lanza semana_pasada (P0001) con detail = el número de la primera semana que difiere, sin tocar nada —, y recién entonces borra las filas de la semana en curso en adelante e inserta las del JSONB con semana >= semana en curso; las filas de semanas pasadas conservan id, fecha_entregada y fecha_consumida. Lanza etapa_inexistente (P0002) y etapa_cerrada (P0001) si la etapa ya terminó. Devuelve void. Acceso: el terapeuta dueño de la etapa o un admin.';

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

-- ---------------------------------------------------------------------------
-- cerrar_etapa
-- ---------------------------------------------------------------------------
-- Cierra la etapa de tratamiento ACTIVA de un paciente con un estado terminal
-- ('finalizada' o 'abandonada'). El terapeuta decide cuándo cerrar: no hay
-- gate de progreso, haya llegado o no el paciente al último nivel (confirmado
-- en el grill de producto).
--
-- Authz: el terapeuta dueño de la etapa activa (etapas_tratamiento.terapeuta_id)
-- o un admin — mismo guard NULL-safe que update_etapa_diagnostico.
--
-- p_motivo es opcional (DEC-11): si viene vacío/whitespace se guarda NULL, NO
-- un texto default (un default como "Reinicio de tratamiento" sería falso
-- cuando el estado es 'abandonada').
--
-- public.hoy() se establece server-side para evitar drift de timezone con el
-- cliente, igual que register_paciente.
--
-- NO se toca estados_paciente: cerrar una etapa no da de baja al paciente
-- (DEC-12, fuera de alcance de esta RPC).
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_etapa(
  p_paciente_id uuid,
  p_estado      text,
  p_motivo      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_fecha_inicio date;
  v_estado_id    uuid;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  -- coalesce(fecha_inicio, created_at) desc, no fecha_inicio desc a secas:
  -- en Postgres `desc` es NULLS FIRST, y una etapa sin arrancar (fecha_inicio
  -- null) no debe flotar al tope solo por eso.
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Autorizar: la asignación activa es la identidad de escritura (DEC-31,
  --    medir-chakras) — etapas_tratamiento.terapeuta_id demota a procedencia
  --    ("quién abrió la etapa"), nunca autorización. is_admin() se preserva
  --    acá: este es el cierre ADMINISTRATIVO (design §1.0/§9.3), a
  --    diferencia de registrar_medicion/cerrar_etapa_con_medicion, que NO
  --    llevan este disjunto (un admin sin asignación puede cerrar pero
  --    nunca medir). has_active_assignment() devuelve exists(...), nunca
  --    NULL — se retira la comparación NULL-safe que hacía falta contra
  --    terapeuta_id.
  if not (public.is_admin() or public.has_active_assignment(p_paciente_id)) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Validar el estado terminal solicitado.
  if p_estado not in ('finalizada', 'abandonada') then
    raise exception 'estado_invalido'
      using errcode = 'P0001',
            detail  = 'p_estado debe ser ''finalizada'' o ''abandonada''';
  end if;

  select ee.id into v_estado_id
    from public.estados_etapa as ee
   where ee.codigo = p_estado;

  if not found then
    raise exception 'estado_etapa_no_encontrado'
      using errcode = 'P0002',
            detail  = 'p_estado no coincide con ningún código de estados_etapa';
  end if;

  -- 3.5. DEC-33 (medir-chakras): la medición de cierre es obligatoria SOLO
  --      cuando p_estado es 'finalizada' Y la etapa arrancó Y quien cierra
  --      tiene asignación activa. Condicional a propósito, no incondicional:
  --      el cierre administrativo sin asignación (admin) y el cierre de una
  --      etapa que nunca arrancó (fuera de alcance, DevSpec §17) siguen sin
  --      exigir medición — un guard incondicional forzaría al admin a cerrar
  --      un tratamiento completo como 'abandonada', corrompiendo ese estado.
  if p_estado = 'finalizada'
     and v_fecha_inicio is not null
     and public.has_active_assignment(p_paciente_id) then
    raise exception 'medicion_cierre_requerida'
      using errcode = 'P0001',
            detail  = 'usar cerrar_etapa_con_medicion';
  end if;

  -- 3.6. Cierre automático de la lectura de estructura (medir-chakras design
  --      §1.4/§3.1), ANTES del update de más abajo: si algo falla acá, la
  --      etapa queda abierta, nunca cerrada sin su copia. No-op si la etapa
  --      no arrancó o no tiene mediciones previas.
  perform public._generar_cierre_automatico(v_etapa_id);

  -- 4. Cerrar la etapa. motivo_cierre es opcional (DEC-11): vacío/whitespace
  --    colapsa a NULL, nunca a un texto default (sería falso si p_estado es
  --    'abandonada'). fecha_finalizacion = public.hoy(), server-side.
  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy(),
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;
end;
$$;

comment on function public.cerrar_etapa(uuid, text, text) is
  'Cierra la etapa activa de un paciente con un estado terminal (finalizada|abandonada): fecha_finalizacion = public.hoy(), estado_id resuelto por slug, motivo_cierre opcional (vacío/whitespace -> NULL). Acceso: is_admin() or has_active_assignment(p_paciente_id) — DEC-31 (medir-chakras): terapeuta_id de la etapa ya NO autoriza, solo procedencia. DEC-33: exige cerrar_etapa_con_medicion (medicion_cierre_requerida, P0001) cuando p_estado=finalizada, la etapa arrancó y el caller tiene asignación activa; el cierre administrativo sin asignación y el de una etapa sin arrancar no exigen medición. Genera cierre_automatico (_generar_cierre_automatico) antes de cerrar, cuando corresponde.';

grant execute on function public.cerrar_etapa(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- iniciar_nueva_etapa
-- ---------------------------------------------------------------------------
-- Abre una NUEVA etapa de tratamiento para un paciente que ya existe.
-- Es un cruce entre register_paciente (crea etapa + niveles + bloqueos +
-- alfabetos) y update_etapa_diagnostico (resuelve terapeuta/authz sobre un
-- paciente ya existente). Requiere que la etapa anterior ya esté cerrada
-- (finalizada/abandonada) via cerrar_etapa.
--
-- GATE DURO (DEC-21): si el paciente ya tiene una etapa activa
-- (fecha_finalizacion IS NULL), falla con etapa_activa_existente. No hay
-- re-diagnóstico implícito acá: cerrar_etapa es un paso previo obligatorio.
--
-- Authz: el terapeuta de la asignación activa del paciente (relación 1:1,
-- asignaciones_paciente.fecha_hasta IS NULL) o un admin. Si no hay asignación
-- activa (hueco de datos), cae a la última etapa (cualquier estado, la más
-- reciente) para resolver un terapeuta dueño, igual que
-- update_paciente_identidad -- pero SIN el filtro fecha_finalizacion IS NULL
-- de aquella función: acá ya sabemos (por el gate duro de arriba) que no hay
-- ninguna etapa abierta, así que ese filtro nunca matchearía.
--
-- DEC-22: la etapa arranca SIN entregas_plan. El terapeuta reasigna el
-- contenido después via set_entregas_plan; esta RPC no toca esa tabla, así
-- que no dispara generar_otp_activacion (el paciente ya tiene cuenta de un
-- tratamiento anterior).
--
-- public.hoy() se establece server-side para evitar drift de timezone con el
-- cliente, igual que register_paciente/cerrar_etapa.
--
-- inicioTratamiento (Epic 1, Task 1.1): igual que register_paciente, la etapa
-- se crea SIN ARRANCAR (fecha_inicio NULL, estado 'pendiente'). El reloj
-- arranca con iniciar_tratamiento, no acá. Los
-- niveles se crean igual pero sin fecha_seguimiento_esperada: se agendan al
-- arrancar (Task 1.2).
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_nueva_etapa(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabetos    jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_etapa_id             uuid;
  v_restriccion          text;
begin
  -- 1. Gate duro: no se puede abrir una etapa nueva si ya hay una activa.
  --    La anterior debe finalizarse/abandonarse (cerrar_etapa) antes.
  if exists (
        select 1
          from public.etapas_tratamiento as et
         where et.paciente_id = p_paciente_id
           and et.fecha_finalizacion is null
      ) then
    raise exception 'etapa_activa_existente'
      using errcode = 'P0001',
            detail  = 'el paciente ya tiene una etapa de tratamiento activa; cerrala antes de abrir una nueva';
  end if;

  -- 2. Resolver el terapeuta dueño desde la asignación activa (relación 1:1).
  --    Fallback a la última etapa (cualquier estado) si no hay asignación
  --    activa, igual que update_paciente_identidad.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  -- Sin filtro fecha_finalizacion is null (a diferencia de
  -- update_paciente_identidad): acá ya sabemos, por el gate duro del paso 1,
  -- que no hay ninguna etapa abierta — ese filtro nunca matchearía. Por eso
  -- este order by recorre TODAS las etapas del paciente, cerradas incluidas,
  -- y coalesce(fecha_inicio, created_at) importa de verdad acá: con
  -- `fecha_inicio desc` a secas (NULLS FIRST en Postgres), una etapa cerrada
  -- que nunca arrancó (DEC-11, fecha_inicio null + fecha_finalizacion seteada)
  -- flotaría al tope y le robaría el terapeuta a la etapa real más reciente.
  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
     order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
     limit 1;
  end if;

  -- 3. Autorizar.
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

  -- 4. Pre-chequear la modalidad (error descriptivo en lugar de violación de
  --    FK genérica) y resolver el estado 'pendiente' por slug. inicioTratamiento:
  --    la etapa nace 'pendiente' (sin arrancar), no 'activa'. El slug lo
  --    garantiza el insert idempotente del schema declarativo (Epic 0, Task 0.1).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado' using errcode = 'P0002';
  end if;

  -- 5. Insertar la etapa nueva. inicioTratamiento: fecha_inicio NULL + estado
  --    'pendiente' — la etapa se crea SIN ARRANCAR. Arranca con
  --    iniciar_tratamiento.
  --
  --    El índice único etapas_tratamiento_una_abierta_por_paciente_idx
  --    (seguridadPanel / SEG-006) es la garantía real de "una sola abierta":
  --    el gate del paso 1 no ve la etapa que otra llamada en paralelo todavía
  --    no confirmó. Si el insert choca contra ese índice, se devuelve el mismo
  --    error legible del gate en vez del 23505 crudo.
  begin
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
      p_paciente_id,
      v_terapeuta_id,
      p_causa_id,
      p_algoritmo_id,
      p_modalidad_id,
      null,
      v_estado_eta_pendiente
    )
    returning id into v_etapa_id;
  exception
    when unique_violation then
      get stacked diagnostics v_restriccion = constraint_name;
      if v_restriccion = 'etapas_tratamiento_una_abierta_por_paciente_idx' then
        raise exception 'etapa_activa_existente'
          using errcode = 'P0001',
                detail  = 'el paciente ya tiene una etapa de tratamiento activa; cerrala antes de abrir una nueva';
      end if;
      raise;
  end;

  -- 5a. Bloqueos de la etapa (bulk via unnest; array vacío/NULL genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 5b. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío
  --     ('[]') genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         (item ->> 'numero')::smallint
    from jsonb_array_elements(p_alfabetos) as item;

  -- 5c. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla se crea igual (invariante "toda etapa
  --     tiene su grilla"), pero SIN fecha_seguimiento_esperada — la etapa
  --     todavía no arrancó. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- Sin entregas_plan (DEC-22): la etapa arranca vacía de contenido; el
  -- terapeuta lo reasigna después via set_entregas_plan.

  -- 6. Devolver el id de la etapa nueva.
  return v_etapa_id;
end;
$$;

comment on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca con iniciar_tratamiento. Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array con una entrada {alfabeto_id, numero} por número; el rango lo valida el trigger validar_numero_alfabeto. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';

grant execute on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- telefono_en_otra_ficha
-- ---------------------------------------------------------------------------
-- Chequeo de duplicados que consume el aviso del panel (activacionPorTelefono,
-- Epic 2 Task 2.2, ADR-0006): con un teléfono compartido -una madre con dos
-- hijos, un cuidador- el paciente no puede activarse solo, y el alta/edición
-- es el único momento en que se puede evitar gratis cargando otro número.
--
-- Solo booleano (DEC-13): nunca devuelve id, nombre ni terapeuta de la otra
-- ficha. El terapeuta que carga el número no tiene por qué saber de quién es
-- la ficha con la que colisiona.
--
-- Acceso: cualquier terapeuta o admin (no está acotado al dueño de la ficha
-- p_excluir_paciente_id -el chequeo es contra la base entera, no una ficha
-- propia). Autorización NULL-safe, mismo patrón que baja_voluntaria_paciente
-- (76_rpcs_baja_voluntaria.sql): sin sesión, auth.uid() es null y el exists
-- da falso, así que el guard falla cerrado.
--
-- p_excluir_paciente_id excluye la propia ficha en edición (para no avisar
-- que el teléfono "ya está en otra ficha" cuando en realidad es el mismo).
-- Un teléfono que no normaliza (normalizar_telefono_ar devuelve null) nunca
-- puede colisionar de verdad -devuelve false sin pegarle a la tabla.
--
-- stable (no muta nada) y usa pacientes_telefono_idx (Task 0.1) para el
-- lookup por igualdad exacta contra la forma canónica.
-- ---------------------------------------------------------------------------

create or replace function public.telefono_en_otra_ficha(
  p_telefono             text,
  p_excluir_paciente_id  uuid default null
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_telefono text;
begin
  -- 1. Autorización NULL-safe: terapeuta existente o admin. Sin sesión,
  --    auth.uid() es null, el exists da falso y el guard falla cerrado.
  --    is_console_user() (seguridadPanel / SEG-008) deja afuera a un terapeuta
  --    desactivado con el token todavía vigente: su fila en terapeutas sigue
  --    existiendo.
  if not (
    public.is_admin()
    or (
      public.is_console_user()
      and exists (select 1 from public.terapeutas where id = auth.uid())
    )
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Normalizar a la forma canónica (fuente única: normalizar_telefono_ar).
  --    Un input que no normaliza no puede colisionar de verdad.
  v_telefono := public.normalizar_telefono_ar(p_telefono);

  if v_telefono is null then
    return false;
  end if;

  -- 3. Chequear si OTRA ficha (excluyendo p_excluir_paciente_id, si vino)
  --    tiene el mismo teléfono canónico. Solo booleano.
  return exists (
    select 1
      from public.pacientes
     where telefono = v_telefono
       and (p_excluir_paciente_id is null or id <> p_excluir_paciente_id)
  );
end;
$$;

comment on function public.telefono_en_otra_ficha(text, uuid) is
  'Chequeo de duplicados de teléfono (activacionPorTelefono, ADR-0006): normaliza p_telefono (normalizar_telefono_ar) y devuelve true si OTRA ficha de pacientes (excluyendo p_excluir_paciente_id) ya lo tiene. Solo booleano -nunca id, nombre ni terapeuta de la otra ficha-, para que el panel avise sin identificar de quién es. Un teléfono que no normaliza devuelve false. Acceso: cualquier terapeuta o admin (autorización NULL-safe: is_admin(), o is_console_user() y auth.uid() resuelve a un terapeuta existente; un terapeuta inactivo queda afuera, seguridadPanel / SEG-008). Usa pacientes_telefono_idx.';

grant execute on function public.telefono_en_otra_ficha(text, uuid) to authenticated;

revoke execute on function public.telefono_en_otra_ficha(text, uuid) from public;
revoke execute on function public.telefono_en_otra_ficha(text, uuid) from anon;
