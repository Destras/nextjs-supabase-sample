-- activacionPorTelefono / ACT-001 — el prefijo de país deja de ser obligatorio
-- en la entrada de normalizar_telefono_ar.
--
-- El /playwright-uat encontró que la ayuda del campo ("Código de área y número,
-- sin el 0 ni el 15.") describía un formato que el validador rechazaba: escribir
-- exactamente `11 5555 1234` daba "Teléfono inválido". El `+54` era obligatorio y
-- no lo decía ningún texto, solo el placeholder.
--
-- Decisión (2026-09-24): se arregla por el lado permisivo, no por la copy.
-- El panel muestra el `+54` como prefijo fijo del campo y el terapeuta escribe
-- solo área + número; la función acepta las dos lecturas (con y sin prefijo de
-- país) y devuelve siempre la forma canónica. Todos los pacientes son de
-- Argentina (ADR-0008), así que el `54` no aporta información: solo fricción.
--
-- Qué NO cambia:
--   - La salida sigue siendo `+54` + 10 dígitos. El check y el trigger de
--     pacientes no se tocan, y ninguna fila existente cambia de valor: todo lo
--     que normalizaba antes normaliza igual ahora (la lectura con prefijo se
--     prueba primero).
--   - El `15` de celular local se sigue rechazando: deja 12 dígitos y no hay
--     forma de distinguirlo de parte del número.
--
-- Escrita a mano (`db diff` no corre en este repo). Espeja
-- supabase/schemas/00_functions.sql y lib/telefonoAr.ts, que comparten tabla de
-- casos para detectar deriva.

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

revoke execute on function public.normalizar_telefono_ar(text) from public, authenticated;

-- Guard: la tabla de casos compartida con lib/telefonoAr.test.ts.
do $$
begin
  -- Nuevo: sin prefijo de país.
  assert public.normalizar_telefono_ar('11 5555 1234')   = '+541155551234';
  assert public.normalizar_telefono_ar('11 5555-1234')   = '+541155551234';
  assert public.normalizar_telefono_ar('011 5555 1234')  = '+541155551234';
  -- Sin cambios: lo que ya andaba sigue dando lo mismo.
  assert public.normalizar_telefono_ar('+5491155550070') = '+541155550070';
  assert public.normalizar_telefono_ar('+541155550070')  = '+541155550070';
  assert public.normalizar_telefono_ar('+5401155550070') = '+541155550070';
  assert public.normalizar_telefono_ar('+54 9 11-5555-0070') = '+541155550070';
  -- Sin cambios: lo que se rechazaba se sigue rechazando.
  assert public.normalizar_telefono_ar('011-15-55550070') is null;
  assert public.normalizar_telefono_ar('+549115555')     is null;
  assert public.normalizar_telefono_ar('+59899123456')   is null;
  assert public.normalizar_telefono_ar('')               is null;
  assert public.normalizar_telefono_ar('+5499415550070') is null;
end $$;

-- Ninguna fila existente debería cambiar: la lectura con prefijo se prueba
-- primero, así que lo ya canónico se mapea a sí mismo. Se verifica igual.
do $$
declare
  v_derivadas int;
begin
  select count(*)
    into v_derivadas
    from public.pacientes as p
   where public.normalizar_telefono_ar(p.telefono) is distinct from p.telefono;

  if v_derivadas > 0 then
    raise exception 'normalizar_telefono_ar_sin_prefijo: % ficha(s) dejarían de ser canónicas', v_derivadas;
  end if;
end $$;
