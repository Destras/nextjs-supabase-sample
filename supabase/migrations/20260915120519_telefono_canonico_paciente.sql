-- activacionPorTelefono, Epic 0 Task 0.1 (ADR-0008 + DEC-01/DEC-02/DEC-05):
-- impone la forma canónica del teléfono de la ficha ('+54' + 10 dígitos) en
-- la base y lo hace obligatorio.
--
-- Hand-written (db diff no funciona en este repo — shadow DB rota por el
-- problema de orden de carga de is_admin(), ver
-- supabase/migrations/20260830170100_baja_voluntaria_foundational.sql).
-- Mirrors el estado final de supabase/schemas/00_functions.sql,
-- supabase/schemas/21_pacientes.sql y supabase/schemas/71_rpcs_pacientes.sql.
--
-- Orden (per DEC-02):
--   1. create or replace normalizar_telefono_ar + revokes.
--   2. Guard: aborta si hay filas que no van a poder normalizar.
--   3. Backfill: normaliza todo lo existente.
--   4. Trigger de normalización + trigger + not null + check + índice.
--   5. create or replace de los RPCs con el guard telefono_requerido.

-- ---------------------------------------------------------------------------
-- 1. normalizar_telefono_ar
-- ---------------------------------------------------------------------------

create or replace function public.normalizar_telefono_ar(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text;
  v_resto   text;
begin
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    return null;
  end if;

  v_digitos := regexp_replace(p_telefono, '\D', '', 'g');

  if v_digitos !~ '^54' then
    return null;
  end if;

  v_resto := substring(v_digitos from 3);

  if v_resto ~ '^9' then
    v_resto := substring(v_resto from 2);
  end if;

  if v_resto ~ '^0' then
    v_resto := substring(v_resto from 2);
  end if;

  if v_resto ~ '^[1-8][0-9]{9}$' then
    return '+54' || v_resto;
  end if;

  return null;
end;
$$;

comment on function public.normalizar_telefono_ar(text) is 'Fuente única de la forma canónica del teléfono de la ficha (ADR-0008): normaliza a ''+54'' + 10 dígitos (sin 9 de celular ni 0 de larga distancia) o devuelve null si el input no representa un teléfono argentino válido. La reusan el trigger de pacientes, solicitar_otp_activacion y telefono_en_otra_ficha; tiene un espejo en TypeScript (normalizarTelefonoAr) que debe mantenerse alineado. Pura, sin grants a anon/authenticated.';

revoke execute on function public.normalizar_telefono_ar(text) from public, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guard: abortar si alguna fila no va a poder quedar canónica.
--    Solo se listan ids (nunca teléfonos).
-- ---------------------------------------------------------------------------

do $$
declare
  v_ids uuid[];
begin
  select array_agg(p.id)
    into v_ids
    from public.pacientes as p
   where p.telefono is null
      or (btrim(p.telefono) <> '' and public.normalizar_telefono_ar(p.telefono) is null);

  if v_ids is not null then
    raise exception 'telefono_canonico_paciente: % ficha(s) con teléfono ausente o no normalizable, ids: %',
      array_length(v_ids, 1), v_ids;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill: normalizar todo lo existente.
-- ---------------------------------------------------------------------------

update public.pacientes
   set telefono = public.normalizar_telefono_ar(telefono)
 where telefono is not null;

-- ---------------------------------------------------------------------------
-- 4. Trigger de normalización + trigger + not null + check + índice.
-- ---------------------------------------------------------------------------

create or replace function public.normalizar_telefono_paciente()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.telefono is null or btrim(new.telefono) = '' then
    new.telefono := null;
    return new;
  end if;

  new.telefono := public.normalizar_telefono_ar(new.telefono);

  if new.telefono is null then
    raise exception 'telefono_invalido' using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.normalizar_telefono_paciente is 'Trigger helper: normaliza pacientes.telefono a su forma canónica (public.normalizar_telefono_ar) antes de cada insert/update. Un valor vacío/whitespace colapsa a NULL (dispara el not null de la columna, 23502); un valor no vacío que no normaliza lanza telefono_invalido (23514).';

drop trigger if exists normalizar_telefono_pacientes on public.pacientes;

create trigger normalizar_telefono_pacientes
  before insert or update of telefono on public.pacientes
  for each row execute function public.normalizar_telefono_paciente();

alter table public.pacientes
  alter column telefono set not null;

alter table public.pacientes
  add constraint pacientes_telefono_canonico_check check (telefono ~ '^\+54[1-8][0-9]{9}$');

create index if not exists pacientes_telefono_idx on public.pacientes (telefono);

-- ---------------------------------------------------------------------------
-- 5. RPCs: telefono_requerido en register_paciente y update_paciente_identidad.
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
    current_date
  )
  returning id into v_paciente_id;

  -- 4b. Asignación terapeuta-paciente (fecha_hasta NULL = activa).
  --     asignado_por = auth.uid() siempre: el caller queda auditado,
  --     incluso si es un admin asignando a otro terapeuta.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por)
  values (v_paciente_id, v_terapeuta_id, current_date, auth.uid());

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
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

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

  -- 2. Actualizar identidad in-place (sin gate de progreso).
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

  update public.pacientes
     set nombre           = btrim(p_nombre),
         fecha_nacimiento = p_fecha_nacimiento,
         email            = btrim(p_email),
         telefono         = nullif(btrim(coalesce(p_telefono, '')), '')
   where id = p_paciente_id;

  if not found then
    raise exception 'paciente_inexistente'
      using errcode = 'P0002',
            detail  = 'p_paciente_id no coincide con ningún paciente';
  end if;
end;
$$;

comment on function public.update_paciente_identidad(uuid, text, date, text, text) is
  'Corrige la identidad de un paciente in-place. Acceso: terapeuta de la asignación activa o admin. Siempre editable (sin gate de progreso). Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes.';
