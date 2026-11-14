-- =============================================================================
-- hoy_dia_local.sql — Assertion tests for pulidoBeta / BETA-031
-- =============================================================================
-- Coverage: ADR 0012 (docs/adr/0012-hoy-es-el-dia-de-argentina.md) — "hoy" es
-- el día de Argentina, no el día UTC del servidor.
--   BLOCK 1 — public.hoy() devuelve el día en America/Argentina/Buenos_Aires,
--             es estable dentro de la transacción y la pueden ejecutar
--             authenticated y service_role, pero no anon.
--   BLOCK 2 — ninguna función de public sigue usando current_date.
--   BLOCK 3 — register_paciente guarda fecha_alta y fecha_desde = public.hoy();
--             iniciar_tratamiento deja
--             fecha_inicio = public.hoy() y el nivel n en public.hoy() + 28 * n;
--             la app del paciente (get_mi_tratamiento_activo) lee semana 1 ese
--             mismo día; cerrar_etapa guarda fecha_finalizacion = public.hoy().
--
-- LÍMITE: now() es el inicio de la transacción y no se puede mover desde SQL,
-- así que no se simula "las 22:00 de Argentina". Se verifica lo verificable: la
-- definición de la función (BLOCK 1), que no queda ningún current_date (BLOCK 2)
-- y que las escrituras usan public.hoy() (BLOCK 3). Corrido entre las 21:00 y
-- las 24:00 de Argentina, el BLOCK 1 además comprueba que public.hoy() y
-- current_date difieren.
--
-- TOOLING (mirrors supabase/tests/mes_de_tratamiento_28_dias.sql — no pgTAP):
-- bloques DO $$ ... ASSERT ... $$ dentro de begin/rollback. Un assert que falla
-- aborta el script con ERROR; cada bloque que pasa imprime "BLOCK N PASSED".
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hoy_dia_local.sql
--   (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- PREREQUISITES: schema aplicado (incluida 20261006120000) + catálogo del seed
-- (roles, estados, causas, algoritmos, modalidades, contenidos de los 5 tipos).
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 + 2 — la función y el inventario
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_esperado date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_hora_ar  int  := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int;
  v_restantes text;
begin
  raise notice '--- BLOCK 1: public.hoy() es el día de Argentina ---';

  assert public.hoy() = v_esperado,
    format('BLOCK 1: public.hoy() = %L, se esperaba %L', public.hoy(), v_esperado);

  -- Argentina es UTC-3 todo el año: el día local nunca va adelante del UTC, y
  -- va exactamente un día atrás entre las 21:00 y las 24:00 locales.
  if v_hora_ar >= 21 then
    assert public.hoy() = (now() at time zone 'UTC')::date - 1,
      'BLOCK 1: entre las 21:00 y las 24:00 de Argentina, hoy() debe ser el día UTC menos 1';
  else
    assert public.hoy() = (now() at time zone 'UTC')::date,
      'BLOCK 1: fuera de la franja 21:00–24:00, hoy() coincide con el día UTC';
  end if;

  -- La zona de la sesión no la mueve: la zona es parte de la función.
  set local time zone 'Asia/Tokyo';
  assert public.hoy() = v_esperado,
    'BLOCK 1: public.hoy() no debe depender de la timezone de la sesión';
  set local time zone 'UTC';

  assert has_function_privilege('authenticated', 'public.hoy()', 'execute'),
    'BLOCK 1: authenticated debe poder ejecutar public.hoy()';
  assert has_function_privilege('service_role', 'public.hoy()', 'execute'),
    'BLOCK 1: service_role debe poder ejecutar public.hoy()';
  assert not has_function_privilege('anon', 'public.hoy()', 'execute'),
    'BLOCK 1: anon no debe poder ejecutar public.hoy()';

  raise notice 'BLOCK 1 PASSED: public.hoy() = día en America/Argentina/Buenos_Aires';

  raise notice '--- BLOCK 2: ninguna función de public usa current_date ---';

  select string_agg(p.proname, ', ' order by p.proname)
    into v_restantes
    from pg_catalog.pg_proc as p
   where p.pronamespace = 'public'::regnamespace
     and p.prosrc ~* 'current_date';
  assert v_restantes is null,
    format('BLOCK 2: siguen usando current_date: %s', v_restantes);

  raise notice 'BLOCK 2 PASSED: sin current_date en las funciones de public';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — las escrituras de negocio usan public.hoy()
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_paciente_user  uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_cantidad_niveles int;
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_plan           jsonb;
  v_fecha          date;
  v_total          int;
  v_ok             int;
  v_tratamiento    jsonb;
begin
  raise notice '--- BLOCK 3: cargar, arrancar y cerrar guardan public.hoy() ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad_id;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'hoy-b3-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  -- Cargar un paciente: fecha_alta y fecha_desde son "hoy".
  v_paciente_id := public.register_paciente(
    'Paciente HOY B3', '1990-01-01', 'hoy-b3-paciente@example.test', '+541155550191',
    v_causa_id, v_algoritmo_id, v_modalidad_id, '{}'::uuid[], '[]'::jsonb, null
  );

  select p.fecha_alta into v_fecha from public.pacientes as p where p.id = v_paciente_id;
  assert v_fecha = public.hoy(),
    format('BLOCK 3: fecha_alta = %L, se esperaba public.hoy() = %L', v_fecha, public.hoy());

  select a.fecha_desde into v_fecha
    from public.asignaciones_paciente as a
   where a.paciente_id = v_paciente_id;
  assert v_fecha = public.hoy(),
    format('BLOCK 3: fecha_desde = %L, se esperaba public.hoy() = %L', v_fecha, public.hoy());

  select e.id, e.fecha_inicio into v_etapa_id, v_fecha
    from public.etapas_tratamiento as e
   where e.paciente_id = v_paciente_id;
  assert v_fecha is null, 'BLOCK 3: la etapa recién creada no debe estar arrancada';

  -- Plan completo: las (cantidad_niveles * 4) semanas con sus 5 slots.
  select jsonb_agg(
           jsonb_build_object(
             'semana', s.semana,
             'orden', t.orden,
             'contenido_id', (
               select c.id from public.contenidos as c where c.tipo = t.tipo limit 1
             )
           )
         )
    into v_plan
    from generate_series(1, v_cantidad_niveles * 4) as s(semana)
   cross join (
     values (1, 'video'), (2, 'audio'), (3, 'egregor'), (4, 'cma'), (5, 'ic')
   ) as t(orden, tipo);

  perform public.iniciar_tratamiento(v_etapa_id, v_plan);

  select e.fecha_inicio into v_fecha
    from public.etapas_tratamiento as e
   where e.id = v_etapa_id;
  assert v_fecha = public.hoy(),
    format('BLOCK 3: fecha_inicio = %L, se esperaba public.hoy() = %L', v_fecha, public.hoy());

  select count(*),
         count(*) filter (
           where n.fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel
         )
    into v_total, v_ok
    from public.niveles as n
   where n.etapa_id = v_etapa_id;
  assert v_total = v_cantidad_niveles and v_ok = v_total,
    format('BLOCK 3: %s de %s niveles agendados en public.hoy() + 28 * n', v_ok, v_total);

  -- La app del paciente cuenta con la misma regla de día: el día del arranque
  -- es la semana 1, nunca la 0.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'hoy-b3-paciente@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.pacientes set user_id = v_paciente_user where id = v_paciente_id;

  perform set_config('request.jwt.claim.sub', v_paciente_user::text, true);
  v_tratamiento := public.get_mi_tratamiento_activo();
  assert (v_tratamiento ->> 'semanaActual')::int = 1,
    format('BLOCK 3: el día del arranque la app debe leer semana 1, leyó %s', v_tratamiento ->> 'semanaActual');

  -- Cerrar (abandonada: no exige medición) guarda fecha_finalizacion = hoy.
  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);
  perform public.cerrar_etapa(v_paciente_id, 'abandonada', null);

  select e.fecha_finalizacion into v_fecha
    from public.etapas_tratamiento as e
   where e.id = v_etapa_id;
  assert v_fecha = public.hoy(),
    format('BLOCK 3: fecha_finalizacion = %L, se esperaba public.hoy() = %L', v_fecha, public.hoy());

  raise notice 'BLOCK 3 PASSED: fecha_alta, fecha_desde, fecha_inicio, niveles y fecha_finalizacion = public.hoy()';
end;
$$;

rollback;
