create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is 'Trigger helper: setea updated_at = now() en cada UPDATE. Usado por todos los set_<table>_updated_at triggers.';

-- Función de trigger: no la llama nadie directo (seguridadPanel / SEG-005).
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- hoy
-- ---------------------------------------------------------------------------
-- Fuente única de "hoy" para toda fecha de negocio (ADR 0012): el día de
-- Argentina, no el día UTC del servidor. La base no tiene timezone configurada,
-- así que current_date es el día UTC y entre las 21:00 y las 24:00 de Argentina
-- ya es "mañana": un plan completado a las 22:00 arrancaba al día siguiente y
-- la ficha mostraba "Semana 0" (pulidoBeta BETA-031).
--
-- Toda columna `date` de negocio (fecha_alta, fecha_inicio, fecha_finalizacion,
-- fecha_desde/hasta, fecha_seguimiento_esperada) y toda comparación contra
-- "hoy" (semana y mes de tratamiento, alertas, evaluación vigente, desbloqueo
-- del contenido en la app del paciente) usa esta función. NUNCA current_date.
-- Los timestamptz (created_at, updated_at, registrada_en…) siguen en UTC.
--
-- La zona vive solo acá: si algún día hay terapeutas en otro huso, se revisa
-- en este único lugar.
--
-- stable: now() es el inicio de la transacción, así que dentro de una misma
-- transacción siempre devuelve el mismo día (igual que current_date).
--
-- Grants: hoy todas las funciones que la llaman son security definer (corren
-- como el owner), pero se otorga igual a authenticated y service_role para que
-- una función security invoker pueda usarla sin romperse. Sin acceso para anon.
-- ---------------------------------------------------------------------------

create or replace function public.hoy()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

comment on function public.hoy() is 'Fuente única de "hoy" para las fechas de negocio (ADR 0012): el día en America/Argentina/Buenos_Aires, no el día UTC del servidor. La usan todas las RPC que guardan una fecha de negocio (fecha_alta, fecha_inicio, fecha_finalizacion, fecha_desde/hasta, fecha_seguimiento_esperada) o comparan contra hoy (semana y mes de tratamiento, alertas, evaluación vigente, desbloqueo de contenido). Nunca usar current_date para eso. Los timestamptz siguen en UTC.';

revoke execute on function public.hoy() from public, anon;
grant execute on function public.hoy() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- normalizar_telefono_ar
-- ---------------------------------------------------------------------------
-- Fuente única de la forma canónica del teléfono de la ficha (ADR-0008,
-- activacionPorTelefono Epic 0 Task 0.1): '+54' + 10 dígitos, sin el 9 de
-- celular ni el 0 de larga distancia. La reusan el trigger
-- normalizar_telefono_pacientes (21_pacientes.sql), solicitar_otp_activacion
-- y telefono_en_otra_ficha (Epics 1 y 2), y tiene un espejo en TypeScript
-- (normalizarTelefonoAr, Task 2.3) cubierto por la misma tabla de casos para
-- detectar deriva entre ambas implementaciones.
--
-- El prefijo de país es OPCIONAL en la entrada (ACT-001): el panel muestra el
-- '+54' como prefijo fijo del campo, así que el terapeuta tipea solo código de
-- área + número. Como todos los pacientes son de Argentina (ADR-0008), el '54'
-- no aporta información y no tiene sentido exigirlo. La salida sigue siendo
-- siempre canónica.
--
-- Regla, en orden:
--   1. null o vacío tras btrim -> null.
--   2. Solo dígitos. Se prueban dos lecturas y gana la primera que valida:
--      a. con prefijo de país, si los dígitos arrancan en '54';
--      b. sin prefijo de país, tomando todo como área + número.
--      El orden importa para '+541155551234'; la lectura (b) además rescata a
--      un hipotético número local de 10 dígitos que empiece con 54.
--   3. Por cada lectura: si empieza con '9', sacarlo; si empieza con '0',
--      sacarlo (ningún código de área argentino empieza con 9 ni 0).
--   4. Si quedan exactamente 10 dígitos y el primero está entre 1 y 8 ->
--      '+54' || resto. Si ninguna lectura valida -> null.
--
-- El '15' de celular local sigue siendo rechazado: deja 12 dígitos y no hay
-- forma de distinguirlo de parte del número (por eso la ayuda dice 'sin el 15').
--
-- Pura (immutable): mismo input siempre da el mismo output, sin leer estado.
-- Sin grants a anon/authenticated: la consumen triggers y funciones
-- security definer desde adentro, nunca directo desde el cliente.
-- ---------------------------------------------------------------------------

create or replace function public.normalizar_telefono_ar(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos  text;
  v_lecturas text[];
  v_lectura  text;
  v_resto    text;
begin
  -- 1. null o vacío tras btrim -> null.
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    return null;
  end if;

  -- 2. Solo dígitos, y las dos lecturas posibles (con y sin prefijo de país).
  v_digitos := regexp_replace(p_telefono, '\D', '', 'g');

  if v_digitos ~ '^54' then
    v_lecturas := array[substring(v_digitos from 3), v_digitos];
  else
    v_lecturas := array[v_digitos];
  end if;

  foreach v_lectura in array v_lecturas loop
    -- 3. Sacar un '9' inicial de celular y/o un '0' inicial de larga distancia
    --    (ningún código de área argentino arranca con 9 ni 0).
    v_resto := v_lectura;

    if v_resto ~ '^9' then
      v_resto := substring(v_resto from 2);
    end if;

    if v_resto ~ '^0' then
      v_resto := substring(v_resto from 2);
    end if;

    -- 4. Exactamente 10 dígitos con el primero entre 1 y 8 -> canónico.
    if v_resto ~ '^[1-8][0-9]{9}$' then
      return '+54' || v_resto;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.normalizar_telefono_ar(text) is 'Fuente única de la forma canónica del teléfono de la ficha (ADR-0008): normaliza a ''+54'' + 10 dígitos (sin 9 de celular ni 0 de larga distancia) o devuelve null si el input no representa un teléfono argentino válido. El prefijo de país es opcional en la entrada (ACT-001): ''11 5555 1234'' y ''+54 9 11 5555 1234'' dan lo mismo. El ''15'' de celular local sigue rechazándose. La reusan el trigger de pacientes, solicitar_otp_activacion y telefono_en_otra_ficha; tiene un espejo en TypeScript (normalizarTelefonoAr) que debe mantenerse alineado. Pura, sin grants a anon/authenticated.';

revoke execute on function public.normalizar_telefono_ar(text) from public, anon, authenticated;

create or replace function public.rechazar_modificacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'modificacion_no_permitida'
    using errcode = '42501',
          detail  = format('%s es insert-only; %s no está permitido', tg_table_name, tg_op);
end;
$$;

comment on function public.rechazar_modificacion is 'Trigger genérico usado por tablas insert-only (documentos_legales, aceptaciones_documentos_legales). Rechaza cualquier evento sobre el que se lo dispare (UPDATE/DELETE/TRUNCATE); cada tabla decide en su propio archivo qué eventos dispara — documentos_legales lo usa para UPDATE, DELETE y TRUNCATE (inmutable sin excepción); aceptaciones_documentos_legales solo para UPDATE (permite DELETE a service_role, ver 24_aceptaciones_documentos_legales.sql).';

-- Función de trigger: no la llama nadie directo (seguridadPanel / SEG-005).
revoke execute on function public.rechazar_modificacion() from public, anon, authenticated;
