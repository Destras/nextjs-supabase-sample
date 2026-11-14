-- NOTA (copia de muestra): causa/algoritmo/modalidad se pasan por id fijo
-- (CAU-01, ALG-01, M_BOSQUE_16 de las migraciones de catálogo) porque sin
-- políticas RLS el rol authenticated no puede leer el catálogo.
-- =============================================================================
-- alfabetos_reales.sql — Assertion tests for alfabetosReales / Epic 0, Task 0.1
-- =============================================================================
-- Coverage: DevSpec §11 (casos 1 a 4) + varios números por RPC.
--   BLOCK 1 — catálogo: 8 filas, orden 1..8, rango_max esperado, sin códigos viejos.
--   BLOCK 2 — dos números del mismo alfabeto en una etapa (insert directo y
--             register_paciente como `authenticated`: el trigger lee el
--             catálogo con RLS).
--   BLOCK 3 — 41 y 0 en Iota -> alfabeto_numero_fuera_de_rango;
--             nulo -> 23502; repetido -> 23505.
--   BLOCK 4 — register_paciente con un número inválido: el paciente no existe.
--   BLOCK 5 — register_paciente, iniciar_nueva_etapa y update_etapa_diagnostico
--             (etapa fresca) con dos números del mismo alfabeto -> dos filas.
--   BLOCK 6 a 9 — set_etapa_alfabetos (Epic 1, Task 1.1; DevSpec §11 casos 5 a 8):
--             6 reemplaza sin tocar el resto aun con progreso; 7 vacío y null;
--             8 sin etapa, otro terapeuta, inactivo, anon, admin; 9 número
--             inválido revierte.
--
-- TOOLING (mirrors plan_borrador.sql — no pgTAP): bloques DO $$ ... ASSERT ... $$
-- dentro de begin/rollback. Cada bloque que pasa imprime "BLOCK N PASSED".
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/alfabetos_reales.sql
--   (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- PREREQUISITES: schema aplicado (incluida 20261015120000) + catálogo del seed.
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================

-- Crea un terapeuta de consola (usuario auth + terapeutas). Devuelve su id.
create or replace function pg_temp.crear_terapeuta(p_tag text)
returns uuid
language plpgsql
as $$
declare
  v_user uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    format('ar-%s@example.test', p_tag), crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles
     set rol_id = (select id from public.roles where codigo = 'terapeuta')
   where id = v_user;
  insert into public.terapeutas (id) values (v_user);
  return v_user;
end;
$$;

-- Alta de un paciente con los alfabetos dados, como el terapeuta (auth.uid()).
create or replace function pg_temp.alta(p_tag text, p_terapeuta uuid, p_alfabetos jsonb)
returns uuid
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
                     jsonb_build_object('sub', p_terapeuta, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_terapeuta::text, true);
  return public.register_paciente(
    format('Paciente AR %s', p_tag), '1990-01-01',
    format('ar-%s-paciente@example.test', p_tag),
    '+541155570' || lpad((random() * 999)::int::text, 3, '0'),
    '7ed2d9ac-e38a-4db9-8ce0-e933ccb4b30f'::uuid,
    'd4638649-fa8c-4415-9c4d-c15ad3b45e5b'::uuid,
    'b2000002-0000-0000-0000-000000000000'::uuid,
    '{}'::uuid[], p_alfabetos, null
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — catálogo
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_esperado text;
  v_real     text;
begin
  assert (select count(*) from public.alfabetos) = 8, 'B1: se esperaban 8 alfabetos';

  assert (select count(*) from public.alfabetos where codigo in ('FUEGO', 'TIERRA', 'VIENTO')) = 0,
    'B1: no deben quedar códigos viejos';

  v_esperado := 'KAPPA:1:40|SIGMA:2:102|IOTA:3:40|BETA:4:12|'
             || 'GAMMA:5:108|ALFA:6:52|ETA:7:55|DELTA:8:40';
  select string_agg(codigo || ':' || orden || ':' || rango_max, '|' order by orden)
    into v_real
    from public.alfabetos;
  assert v_real = v_esperado, format('B1: catálogo inesperado: %s', v_real);

  raise notice 'BLOCK 1 PASSED: catálogo de 8 alfabetos';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — varios números del mismo alfabeto
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter      uuid := pg_temp.crear_terapeuta('b2');
  v_alfa     uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_pac      uuid;
  v_pac2     uuid;
begin
  -- Insert directo (como postgres).
  v_pac := pg_temp.alta('b2-directo', v_ter, '[]'::jsonb);
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select e.id, v_alfa, n
    from public.etapas_tratamiento as e, unnest(array[15, 21]) as n
   where e.paciente_id = v_pac;
  assert (select count(*) from public.etapa_alfabetos ea
            join public.etapas_tratamiento e on e.id = ea.etapa_id
           where e.paciente_id = v_pac) = 2, 'B2: se esperaban 2 filas por insert directo';

  -- Vía register_paciente como authenticated: el trigger ve el catálogo con RLS.
  perform set_config('request.jwt.claims',
                     jsonb_build_object('sub', v_ter, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_ter::text, true);
  set local role authenticated;
  v_pac2 := public.register_paciente(
    'Paciente AR b2-auth', '1990-01-01', 'ar-b2-auth@example.test', '+541155570991',
    '7ed2d9ac-e38a-4db9-8ce0-e933ccb4b30f'::uuid,
    'd4638649-fa8c-4415-9c4d-c15ad3b45e5b'::uuid,
    'b2000002-0000-0000-0000-000000000000'::uuid,
    '{}'::uuid[],
    jsonb_build_array(
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 15),
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 21)
    ), null
  );
  reset role;

  assert (select count(*) from public.etapa_alfabetos ea
            join public.etapas_tratamiento e on e.id = ea.etapa_id
           where e.paciente_id = v_pac2) = 2, 'B2: se esperaban 2 filas vía authenticated';

  raise notice 'BLOCK 2 PASSED: varios números por alfabeto, también como authenticated';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — rango, nulo y repetido
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter    uuid := pg_temp.crear_terapeuta('b3');
  v_alfa   uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_pac    uuid := pg_temp.alta('b3', v_ter, '[]'::jsonb);
  v_etapa  uuid;
  v_n      int;
begin
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;

  foreach v_n in array array[41, 0] loop
    begin
      insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
      values (v_etapa, v_alfa, v_n);
      assert false, format('B3: el %s debía rechazarse', v_n);
    exception
      when sqlstate 'P0001' then
        assert sqlerrm = 'alfabeto_numero_fuera_de_rango',
          format('B3: mensaje inesperado para %s: %s', v_n, sqlerrm);
    end;
  end loop;

  begin
    insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
    values (v_etapa, v_alfa, null);
    assert false, 'B3: el nulo debía rechazarse';
  exception
    when not_null_violation then
      null; -- 23502
  end;

  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values (v_etapa, v_alfa, 7);
  begin
    insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values (v_etapa, v_alfa, 7);
    assert false, 'B3: el repetido debía rechazarse';
  exception
    when unique_violation then
      null; -- 23505
  end;

  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 1,
    'B3: solo debe quedar el 7';

  raise notice 'BLOCK 3 PASSED: rango, nulo y repetido';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 — register_paciente con un número inválido no crea el paciente
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter  uuid := pg_temp.crear_terapeuta('b4');
  v_alfa uuid := (select id from public.alfabetos where codigo = 'IOTA');
begin
  begin
    perform pg_temp.alta('b4', v_ter, jsonb_build_array(
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 15),
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 41)
    ));
    assert false, 'B4: el alta con un 41 debía fallar';
  exception
    when sqlstate 'P0001' then
      assert sqlerrm = 'alfabeto_numero_fuera_de_rango', format('B4: mensaje inesperado: %s', sqlerrm);
  end;

  assert (select count(*) from public.pacientes where email = 'ar-b4-paciente@example.test') = 0,
    'B4: el paciente no debe existir';

  raise notice 'BLOCK 4 PASSED: alta atómica ante número inválido';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5 — las tres RPCs con dos números del mismo alfabeto -> dos filas
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter    uuid := pg_temp.crear_terapeuta('b5');
  v_alfa   uuid := (select id from public.alfabetos where codigo = 'SIGMA');
  v_json   jsonb := jsonb_build_array(
             jsonb_build_object('alfabeto_id', (select id from public.alfabetos where codigo = 'SIGMA'), 'numero', 17),
             jsonb_build_object('alfabeto_id', (select id from public.alfabetos where codigo = 'SIGMA'), 'numero', 90));
  v_pac    uuid;
  v_etapa  uuid;
  v_nueva  uuid;
  v_causa  uuid := '7ed2d9ac-e38a-4db9-8ce0-e933ccb4b30f'::uuid;
  v_algo   uuid := 'd4638649-fa8c-4415-9c4d-c15ad3b45e5b'::uuid;
  v_mod    uuid := 'b2000002-0000-0000-0000-000000000000'::uuid;
begin
  -- register_paciente
  v_pac := pg_temp.alta('b5', v_ter, v_json);
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 2,
    'B5: register_paciente debe crear 2 filas';

  -- update_etapa_diagnostico (etapa fresca): reemplaza por otros dos números
  perform public.update_etapa_diagnostico(
    v_pac, v_causa, v_algo, v_mod, '{}'::uuid[],
    jsonb_build_array(
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 3),
      jsonb_build_object('alfabeto_id', v_alfa, 'numero', 102)));
  assert (select string_agg(numero::text, ',' order by numero) from public.etapa_alfabetos where etapa_id = v_etapa) = '3,102',
    'B5: update_etapa_diagnostico debe dejar 3 y 102';

  -- iniciar_nueva_etapa: cerrar la etapa y abrir otra
  perform public.cerrar_etapa(v_pac, 'finalizada', null);
  v_nueva := public.iniciar_nueva_etapa(v_pac, v_causa, v_algo, v_mod, '{}'::uuid[], v_json);
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_nueva) = 2,
    'B5: iniciar_nueva_etapa debe crear 2 filas';

  raise notice 'BLOCK 5 PASSED: las tres RPCs aceptan varios números';
end;
$$;

rollback;

-- Se loguea como el usuario dado (claims + rol authenticated).
create or replace function pg_temp.login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
                     jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6 — set_etapa_alfabetos con progreso: reemplaza y no toca el resto
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter     uuid := pg_temp.crear_terapeuta('b6');
  v_exo     uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_tel     uuid := (select id from public.alfabetos where codigo = 'SIGMA');
  v_pac     uuid;
  v_etapa   uuid;
  v_antes   text;
  v_despues text;
  v_codigo  text;
begin
  v_pac := pg_temp.alta('b6', v_ter, jsonb_build_array(
    jsonb_build_object('alfabeto_id', v_exo, 'numero', 15)));
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;

  -- Progreso: una evaluación colgando de un nivel.
  insert into public.nivel_evaluacion (nivel_id, score, fecha_respuesta)
  select n.id, 4, now() from public.niveles as n
   where n.etapa_id = v_etapa order by n.numero_nivel limit 1;

  select concat_ws('|',
           (select concat_ws(',', causa_id, algoritmo_id, modalidad_id) from public.etapas_tratamiento where id = v_etapa),
           (select string_agg(bloqueo_id::text, ',' order by bloqueo_id) from public.etapa_bloqueos where etapa_id = v_etapa),
           (select string_agg(id || '/' || fecha_seguimiento_esperada, ',' order by numero_nivel) from public.niveles where etapa_id = v_etapa))
    into v_antes;

  perform pg_temp.login(v_ter);
  perform public.set_etapa_alfabetos(v_pac, jsonb_build_array(
    jsonb_build_object('alfabeto_id', v_tel, 'numero', 17),
    jsonb_build_object('alfabeto_id', v_tel, 'numero', 90)));

  -- En la misma etapa, la corrección de diagnóstico sigue bloqueada.
  begin
    perform public.update_etapa_diagnostico(
      v_pac, '7ed2d9ac-e38a-4db9-8ce0-e933ccb4b30f'::uuid, 'd4638649-fa8c-4415-9c4d-c15ad3b45e5b'::uuid,
      'b2000002-0000-0000-0000-000000000000'::uuid, '{}'::uuid[], '[]'::jsonb);
    assert false, 'B6: update_etapa_diagnostico debía fallar';
  exception
    when sqlstate 'P0001' then
      assert sqlerrm = 'etapa_con_progreso', format('B6: mensaje inesperado: %s', sqlerrm);
  end;
  reset role;

  select concat_ws('|',
           (select concat_ws(',', causa_id, algoritmo_id, modalidad_id) from public.etapas_tratamiento where id = v_etapa),
           (select string_agg(bloqueo_id::text, ',' order by bloqueo_id) from public.etapa_bloqueos where etapa_id = v_etapa),
           (select string_agg(id || '/' || fecha_seguimiento_esperada, ',' order by numero_nivel) from public.niveles where etapa_id = v_etapa))
    into v_despues;
  assert v_antes = v_despues, 'B6: causa, algoritmo, modalidad, bloqueos o niveles cambiaron';

  assert (select string_agg(alfabeto_id || ':' || numero, ',' order by numero)
            from public.etapa_alfabetos where etapa_id = v_etapa) = v_tel || ':17,' || v_tel || ':90',
    'B6: los alfabetos debían quedar en Sigma 17 y 90';

  raise notice 'BLOCK 6 PASSED: reemplaza alfabetos con progreso sin tocar el resto';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 7 — [] y null dejan cero filas
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter   uuid := pg_temp.crear_terapeuta('b7');
  v_exo   uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_pac   uuid;
  v_etapa uuid;
begin
  v_pac := pg_temp.alta('b7', v_ter, jsonb_build_array(
    jsonb_build_object('alfabeto_id', v_exo, 'numero', 15)));
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;

  perform pg_temp.login(v_ter);
  perform public.set_etapa_alfabetos(v_pac, '[]'::jsonb);
  reset role;
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 0,
    'B7: [] debía dejar cero filas';

  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values (v_etapa, v_exo, 21);
  perform pg_temp.login(v_ter);
  perform public.set_etapa_alfabetos(v_pac, null);
  reset role;
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 0,
    'B7: null debía dejar cero filas';

  raise notice 'BLOCK 7 PASSED: [] y null vacían los alfabetos';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 8 — autorización y etapa inexistente
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter     uuid := pg_temp.crear_terapeuta('b8');
  v_otro    uuid := pg_temp.crear_terapeuta('b8-otro');
  v_inact   uuid := pg_temp.crear_terapeuta('b8-inact');
  v_admin   uuid := pg_temp.crear_terapeuta('b8-admin');
  v_exo     uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_json    jsonb := jsonb_build_array(jsonb_build_object('alfabeto_id', v_exo, 'numero', 21));
  v_pac     uuid;
  v_pac_in  uuid;
  v_etapa   uuid;
begin
  update public.profiles
     set rol_id = (select id from public.roles where codigo = 'admin')
   where id = v_admin;

  v_pac := pg_temp.alta('b8', v_ter, '[]'::jsonb);
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;
  v_pac_in := pg_temp.alta('b8-inact', v_inact, '[]'::jsonb);

  -- Sin etapa abierta.
  update public.etapas_tratamiento set fecha_finalizacion = current_date where paciente_id = v_pac_in;
  perform pg_temp.login(v_inact);
  begin
    perform public.set_etapa_alfabetos(v_pac_in, v_json);
    assert false, 'B8: sin etapa abierta debía fallar';
  exception
    when sqlstate 'P0002' then
      assert sqlerrm = 'etapa_activa_no_encontrada', format('B8: mensaje inesperado: %s', sqlerrm);
  end;
  reset role;

  -- Otro terapeuta.
  perform pg_temp.login(v_otro);
  begin
    perform public.set_etapa_alfabetos(v_pac, v_json);
    assert false, 'B8: otro terapeuta debía fallar';
  exception
    when sqlstate '42501' then
      assert sqlerrm = 'no_autorizado', format('B8: mensaje inesperado: %s', sqlerrm);
  end;
  reset role;

  -- Terapeuta dueño pero inactivo.
  update public.terapeutas
     set estado_id = (select id from public.estados_terapeuta where codigo = 'inactivo')
   where id = v_ter;
  perform pg_temp.login(v_ter);
  begin
    perform public.set_etapa_alfabetos(v_pac, v_json);
    assert false, 'B8: terapeuta inactivo debía fallar';
  exception
    when sqlstate '42501' then
      null;
  end;
  reset role;
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 0,
    'B8: los intentos rechazados no deben escribir';

  -- anon: sin EXECUTE (no se llama: llamar sin privilegio ha tumbado el Postgres local).
  assert not has_function_privilege('anon', 'public.set_etapa_alfabetos(uuid, jsonb)', 'execute'),
    'B8: anon no debe poder ejecutar';
  assert has_function_privilege('authenticated', 'public.set_etapa_alfabetos(uuid, jsonb)', 'execute'),
    'B8: authenticated debe poder ejecutar';

  -- Admin sobre un paciente ajeno.
  perform pg_temp.login(v_admin);
  perform public.set_etapa_alfabetos(v_pac, v_json);
  reset role;
  assert (select count(*) from public.etapa_alfabetos where etapa_id = v_etapa) = 1,
    'B8: el admin debía poder corregir los alfabetos';

  raise notice 'BLOCK 8 PASSED: autorización, etapa inexistente, anon y admin';
end;
$$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 9 — número inválido: error y los alfabetos anteriores siguen
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_ter   uuid := pg_temp.crear_terapeuta('b9');
  v_exo   uuid := (select id from public.alfabetos where codigo = 'IOTA');
  v_pac   uuid;
  v_etapa uuid;
begin
  v_pac := pg_temp.alta('b9', v_ter, jsonb_build_array(
    jsonb_build_object('alfabeto_id', v_exo, 'numero', 15)));
  select id into v_etapa from public.etapas_tratamiento where paciente_id = v_pac;

  perform pg_temp.login(v_ter);
  begin
    perform public.set_etapa_alfabetos(v_pac, jsonb_build_array(
      jsonb_build_object('alfabeto_id', v_exo, 'numero', 21),
      jsonb_build_object('alfabeto_id', v_exo, 'numero', 41)));
    assert false, 'B9: el 41 debía fallar';
  exception
    when sqlstate 'P0001' then
      assert sqlerrm = 'alfabeto_numero_fuera_de_rango', format('B9: mensaje inesperado: %s', sqlerrm);
  end;
  reset role;

  assert (select string_agg(numero::text, ',') from public.etapa_alfabetos where etapa_id = v_etapa) = '15',
    'B9: los alfabetos anteriores debían seguir (solo el 15)';

  raise notice 'BLOCK 9 PASSED: un número inválido revierte el reemplazo';
end;
$$;

rollback;
