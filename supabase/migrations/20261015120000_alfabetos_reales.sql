-- =============================================================================
-- alfabetos_reales (feature alfabetosReales, Epic 0, Task 0.1)
-- =============================================================================
-- Catálogo de 8 alfabetos (nombres de ejemplo) con su rango (rango_max) y orden, una fila por
-- número en etapa_alfabetos y un trigger que valida el rango (ADR 0015).
-- Escrita a mano (supabase db diff no funciona en este repo). Todo en una sola
-- transacción. Rollback: supabase/rollbacks/20261015120000_alfabetos_reales.down.sql
-- (reversa estructural: no recupera los datos borrados).
--
-- Decisión del equipo (2026-10-15): las etapas ABIERTAS que tenían Fuego, Tierra
-- o Viento no quedan vacías: reciben Kappa 1 PROVISORIO (paso 0 y paso
-- 11). El terapeuta lo corrige desde Editar. Las etapas cerradas no se tocan:
-- pierden sus alfabetos viejos y quedan sin alfabetos (no se pueden editar).
-- =============================================================================

begin;

-- 0. Antes de borrar nada: qué etapas ABIERTAS (fecha_finalizacion is null)
--    tienen filas de Fuego, Tierra o Viento. Son las que reciben Kappa 1
--    provisorio en el paso 11. Las cerradas quedan afuera a propósito.
--    on commit drop: la tabla temporal muere con el commit de este archivo.
create temporary table _etapas_alfabeto_provisorio on commit drop as
select distinct ea.etapa_id
  from public.etapa_alfabetos as ea
  join public.alfabetos as a on a.id = ea.alfabeto_id
  join public.etapas_tratamiento as et on et.id = ea.etapa_id
 where a.codigo in ('FUEGO', 'TIERRA', 'VIENTO')
   and et.fecha_finalizacion is null;

-- 1-2. Fuera los alfabetos inventados. Las FK de etapa_alfabetos no tienen
--      on delete, así que el hijo va primero.
delete from public.etapa_alfabetos
 where alfabeto_id in (
   select id from public.alfabetos where codigo in ('FUEGO', 'TIERRA', 'VIENTO')
 );

delete from public.alfabetos where codigo in ('FUEGO', 'TIERRA', 'VIENTO');

-- 3. Columnas nuevas del catálogo.
alter table public.alfabetos
  add column rango_max smallint,
  add column orden smallint;

-- 4. Los 8 alfabetos (nombres de ejemplo), con UUIDs fijos.
insert into public.alfabetos (id, codigo, nombre, descripcion, rango_max, orden) values
  ('a9000101-0000-0000-0000-000000000000', 'KAPPA', 'Kappa', null, 40, 1),
  ('a9000102-0000-0000-0000-000000000000', 'SIGMA', 'Sigma', null, 102, 2),
  ('a9000103-0000-0000-0000-000000000000', 'IOTA', 'Iota', null, 40, 3),
  ('a9000104-0000-0000-0000-000000000000', 'BETA', 'Beta', null, 12, 4),
  ('a9000105-0000-0000-0000-000000000000', 'GAMMA', 'Gamma', null, 108, 5),
  ('a9000106-0000-0000-0000-000000000000', 'ALFA', 'Alfa', null, 52, 6),
  ('a9000107-0000-0000-0000-000000000000', 'ETA', 'Eta', null, 55, 7),
  ('a9000108-0000-0000-0000-000000000000', 'DELTA', 'Delta', null, 40, 8);

-- 5. Constraints del catálogo.
alter table public.alfabetos
  alter column rango_max set not null,
  add constraint alfabetos_rango_max_check check (rango_max >= 1),
  alter column orden set not null,
  add constraint alfabetos_orden_key unique (orden);

-- 6. Defensivo: no debería quedar ninguna fila sin número.
delete from public.etapa_alfabetos where numero is null;

-- 7. etapa_alfabetos: una fila por número.
alter table public.etapa_alfabetos
  alter column numero type smallint,
  alter column numero set not null,
  add constraint etapa_alfabetos_numero_check check (numero >= 1);

alter table public.etapa_alfabetos drop constraint etapa_alfabetos_pkey;
alter table public.etapa_alfabetos add primary key (etapa_id, alfabeto_id, numero);

-- 8. Trigger de rango. security definer para leer el catálogo con RLS; sin
--    grant: PostgreSQL no chequea EXECUTE cuando dispara un trigger (DEC-02).
create or replace function public.validar_numero_alfabeto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rango_max smallint;
  v_codigo    text;
begin
  select a.rango_max, a.codigo
    into v_rango_max, v_codigo
    from public.alfabetos as a
   where a.id = new.alfabeto_id;

  if new.numero is not null and (new.numero < 1 or new.numero > v_rango_max) then
    raise exception 'alfabeto_numero_fuera_de_rango'
      using errcode = 'P0001',
            detail = format('%s admite del 1 al %s', v_codigo, v_rango_max);
  end if;

  return new;
end;
$$;

comment on function public.validar_numero_alfabeto() is
  'Trigger: rechaza con alfabeto_numero_fuera_de_rango (P0001) un número fuera de 1..alfabetos.rango_max. El nulo lo rechaza el not null de etapa_alfabetos.numero.';

create trigger validar_numero_alfabeto_trg
  before insert or update on public.etapa_alfabetos
  for each row execute function public.validar_numero_alfabeto();

-- 9. RPCs: el insert a etapa_alfabetos ya no usa nullif (una fila por número).
--    La firma no cambia, así que los grants existentes se conservan.
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

-- 10. Comentarios de tablas.
comment on table public.alfabetos is 'Catálogo cerrado de los 8 alfabetos del método. Cada uno admite los números del 1 a rango_max (ADR 0015); orden fija cómo se muestran (1..8).';
comment on table public.etapa_alfabetos is 'Tabla puente que registra qué alfabetos y qué números de cada alfabeto se aplicaron en cada etapa de tratamiento: una fila por número (ADR 0015).';

-- 11. Kappa 1 PROVISORIO para las etapas abiertas del paso 0 (decisión
--     del equipo, 2026-10-15). No es un dato clínico: es un placeholder para que
--     el terapeuta vea algo en la ficha en vez de una etapa sin alfabetos, y
--     lo reemplace por los alfabetos reales desde Editar. Va después del
--     catálogo nuevo, la PK (etapa_id, alfabeto_id, numero) y el trigger de
--     rango, así que pasa por las mismas validaciones que cualquier alta.
--     Las etapas cerradas no se tocan: quedan sin alfabetos.
insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
select p.etapa_id, 'a9000101-0000-0000-0000-000000000000'::uuid, 1
  from _etapas_alfabeto_provisorio as p
on conflict do nothing;

commit;
