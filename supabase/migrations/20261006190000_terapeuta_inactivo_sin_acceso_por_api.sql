-- =============================================================================
-- seguridadPanel / SEG-008 — Un terapeuta desactivado no lee ni escribe por API
-- =============================================================================
-- SEG-007 hizo que is_console_user() e is_admin() devuelvan false para un
-- terapeuta en estado `inactivo`. Pero los guards y las policies que autorizan
-- por DUEÑO (auth.uid() = terapeuta de la etapa, una fila en
-- asignaciones_paciente, has_active_assignment) no pasaban por ahí: con el
-- access token todavía vigente (hasta 1 h) y llamando a PostgREST a mano, un
-- terapeuta desactivado seguía leyendo las fichas de sus pacientes
-- (pacientes, asignaciones, etapas, niveles, evaluaciones, plan, alfabetos,
-- mediciones) y escribiendo (set_entregas_plan, update_etapa_diagnostico,
-- update_paciente_identidad, iniciar_nueva_etapa, cierres, mediciones,
-- alertas).
--
-- Una sola regla: TODO lo que autoriza por dueño exige además
-- public.is_console_user(). Es la misma función que ya usa el resto, así que
-- el criterio es el de SEG-007 (solo `inactivo` corta; `pendiente`, sin estado
-- y un admin sin fila en terapeutas no cambian) y no hay un segundo lugar
-- donde decidir quién está activo.
--
--   1. has_active_assignment(): el chequeo va adentro. Es el punto común de 8
--      policies en 7 tablas (etapas_tratamiento, niveles, nivel_evaluacion, etapa_bloqueos,
--      mediciones_estructura, medicion_valores, alertas_atendidas ×2) y de 7
--      RPC (cerrar_etapa, cerrar_etapa_con_medicion, registrar_medicion,
--      editar_medicion, get_estructura_paciente, marcar_alerta_atendida,
--      desmarcar_alerta_atendida): ninguno se toca.
--   2. Las 4 policies que comparan auth.uid() directo (pacientes,
--      asignaciones_paciente, entregas_plan, etapa_alfabetos): se les antepone
--      `(select public.is_console_user()) and`. Mismos nombres, mismo alcance.
--      La de pacientes sigue alcanzando asignaciones cerradas (no mira
--      fecha_hasta): no se restringe acá, es una decisión de producto.
--   3. Los 7 guards "admin o dueño" (register_paciente,
--      update_paciente_identidad, update_etapa_diagnostico, set_entregas_plan,
--      iniciar_nueva_etapa, get_frases_del_tratamiento_activo,
--      list_pacientes_by_terapeuta) quedan con un único patrón NULL-safe:
--        is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
--   4. telefono_en_otra_ficha, list_alertas_terapeuta y count_alertas_terapeuta
--      suman is_console_user().
--
-- Los RPC de la app del paciente (get_mi_*, submit_mi_evaluacion) autorizan por
-- pacientes.user_id y no se tocan. Ninguna policy sirve al paciente: la app no
-- lee tablas.
--
-- Las funciones se recrean con `create or replace` y el cuerpo actual del
-- schema declarativo: misma firma, security definer, volatilidad y
-- search_path; los grants no cambian (create or replace conserva el ACL).
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. has_active_assignment exige consola activa
-- ---------------------------------------------------------------------------

create or replace function public.has_active_assignment(p_paciente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_console_user()
     and exists (
       select 1
         from public.asignaciones_paciente a
        where a.paciente_id  = p_paciente_id
          and a.terapeuta_id = auth.uid()
          and a.fecha_hasta is null
     );
$$;

comment on function public.has_active_assignment is
  'Devuelve true si auth.uid() es un usuario de consola activo (is_console_user(): un terapeuta inactivo da false, seguridadPanel / SEG-008) y tiene una asignación activa (fecha_hasta IS NULL) sobre el paciente dado. Usada en políticas RLS de tablas clínicas para habilitar handoff y como guard de los RPC de medición, cierre y alertas. Nunca devuelve NULL.';

-- ---------------------------------------------------------------------------
-- 2. Policies de dueño: consola activa + la condición de siempre
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Guards "admin o dueño": un solo patrón, NULL-safe y con consola activa
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
         nullif(item ->> 'numero', '')::int
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
  'Corrige el diagnóstico/plan de la etapa activa in-place (causa, algoritmo, modalidad, bloqueos, alfabetos). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: terapeuta de la etapa o admin. Gate de frescura: solo si la etapa no tiene progreso. Cambiar modalidad regenera la grilla de niveles (fecha_seguimiento_esperada = fecha_inicio + 28 * numero_nivel: un mes de tratamiento son 28 días, ADR 0011).';

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
  --    'pendiente' — la etapa se crea SIN ARRANCAR. Arranca cuando
  --    set_entregas_plan completa el plan de contenido (Task 1.2).
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
         nullif(item ->> 'numero', '')::int
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
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';

create or replace function public.get_frases_del_tratamiento_activo(p_paciente_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
  v_etapa_id     uuid;
  v_result       jsonb;
begin
  -- 1. Resolver el terapeuta dueño vía la asignación activa del paciente.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  -- 2. Autorizar.
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

  -- 3. Resolver la etapa activa del paciente (mismo criterio que
  --    get_mi_plan_semanal: fecha_finalizacion IS NULL, la más reciente).
  select et.id into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  -- Paciente sin etapa activa -> [] (no lanza: el asignador lo trata como
  -- "sin plan").
  if v_etapa_id is null then
    return '[]'::jsonb;
  end if;

  -- 4. Delegar en frases_de_etapa y agrupar por semana (DEC-0-5).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana', semanas.semana,
      'frases', semanas.frases
    )
    order by semanas.semana
  ), '[]'::jsonb)
  into v_result
  from (
    select f.semana,
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
  ) as semanas;

  return v_result;
end;
$$;

comment on function public.get_frases_del_tratamiento_activo(uuid) is
  'Devuelve las frases motivacionales derivadas del tratamiento activo de un paciente, agrupadas por semana ([{ semana, frases: [{ orden, origen, texto }] }]). Paciente sin etapa activa -> []. Acceso: el terapeuta asignado al paciente (asignación activa) o un admin, con comparación NULL-safe.';

create or replace function public.list_pacientes_by_terapeuta(p_terapeuta_id uuid)
returns table(
  asignacion_id            uuid,
  paciente_nombre          text,
  nivel_actual             int,
  ultima_evaluacion        timestamptz,
  fecha_inicio_tratamiento date
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  -- Hasta SEG-005 este guard fallaba ABIERTO sin sesión: una llamada sin login
  -- listaba los pacientes de cualquier terapeuta.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() es lo que deja afuera a un terapeuta desactivado con el
  -- token todavía vigente, y nunca devuelve NULL (sin sesión da false). El
  -- `is not null` cierra el otro NULL: si el dueño no resuelve,
  -- `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and p_terapeuta_id is not null and auth.uid() = p_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select ap.id                                                                  as asignacion_id,
           coalesce(pa.nombre, '')                                                as paciente_nombre,
           (
             select max(n.numero_nivel)::int
               from public.niveles              n
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id        = pa.id
                and e.fecha_finalizacion is null
           )                                                                      as nivel_actual,
           (
             select max(ne.fecha_respuesta)
               from public.nivel_evaluacion     ne
               join public.niveles              n on n.id = ne.nivel_id
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id = pa.id
           )                                                                      as ultima_evaluacion,
           ap.fecha_desde                                                         as fecha_inicio_tratamiento
      from public.asignaciones_paciente ap
      join public.pacientes             pa on pa.id = ap.paciente_id
     where ap.terapeuta_id = p_terapeuta_id
       and ap.fecha_hasta  is null
     order by pa.nombre;
end;
$$;

comment on function public.list_pacientes_by_terapeuta(uuid) is
  'Lista los pacientes activos asignados a un terapeuta, con nivel actual (max de niveles en etapas no finalizadas) y última evaluación (max fecha_respuesta cross-etapa). Acceso: el propio terapeuta o un admin.';

-- ---------------------------------------------------------------------------
-- 4. Los que autorizaban por "es terapeuta" o por auth.uid() a secas
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

create or replace function public.list_alertas_terapeuta()
returns table (
  paciente_id      uuid,
  paciente_nombre  text,
  terapeuta_id     uuid,
  terapeuta_nombre text,
  tipo             text,
  evento_ref       text,
  valor            int,
  fecha            timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select d.paciente_id,
         d.paciente_nombre,
         d.terapeuta_id,
         d.terapeuta_nombre,
         d.tipo,
         d.evento_ref,
         d.valor,
         d.fecha
    from public.derive_alertas_activas() d
   where d.terapeuta_id = auth.uid()
     -- Consola activa (seguridadPanel / SEG-008): a un terapeuta desactivado
     -- con el token todavía vigente no le devuelve nada.
     and public.is_console_user();
$$;

comment on function public.list_alertas_terapeuta is
  'Alertas activas del caseload propio del terapeuta autenticado: filtra derive_alertas_activas() por terapeuta_id = auth.uid() y exige is_console_user() (un terapeuta inactivo recibe cero filas, seguridadPanel / SEG-008). El scoping ES el enforcement. Devuelve las 8 columnas del motor (incluye terapeuta_nombre, el propio nombre, para matchear la forma que espera mapAlertaRow).';

create or replace function public.count_alertas_terapeuta()
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
    from public.derive_alertas_activas()
   where terapeuta_id = auth.uid()
     -- Consola activa (seguridadPanel / SEG-008): un terapeuta desactivado
     -- con el token todavía vigente cuenta 0.
     and public.is_console_user();
$$;

comment on function public.count_alertas_terapeuta is
  'Cuenta las alertas activas del caseload propio del terapeuta autenticado (personal para todos los roles, incluido el admin; un terapeuta inactivo cuenta 0, seguridadPanel / SEG-008). Payload chico para la campana de acceso global — no trae la lista, solo el entero. No hay count_alertas_admin: la supervisión de la red sale de /terapeutas (Epic 2).';
