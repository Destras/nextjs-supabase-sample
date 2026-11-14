-- =============================================================================
-- mes_de_tratamiento_28_dias.sql — Assertion tests for pulidoBeta / BETA-018
-- =============================================================================
-- Coverage: ADR 0011 (docs/adr/0011-un-mes-de-tratamiento-son-4-semanas.md) —
-- un mes de tratamiento son 28 días desde etapas_tratamiento.fecha_inicio,
-- nunca un mes calendario.
--   BLOCK 1 — iniciar_tratamiento: al arrancar, el recompute agenda
--             el nivel n en public.hoy() + 28 * n.
--   BLOCK 2 — update_etapa_diagnostico: cambiar la modalidad regenera la
--             grilla en fecha_inicio + 28 * n.
--   BLOCK 3 — get_admin_dashboard_stats: día 27 → mes 1; día 28 → mes 2.
--   BLOCK 4 — derive_alertas_activas: mes_3 salta el día 56 (no el 55) y fin
--             el día 84 (no el 83).
--   BLOCK 5 — derive_alertas_activas: reinicio dispara con menos de 28 días
--             (día 27) y no con 28; nunca para la primera etapa.
--
-- TOOLING (mirrors supabase/tests/mediciones_estructura.sql — no pgTAP): SQL
-- assertion blocks using DO $$ ... ASSERT ... $$ wrapped in transactions that
-- ROLLBACK after each group to keep the DB clean. Un assert que falla aborta
-- el script con ERROR; cada bloque que pasa imprime "BLOCK N PASSED".
--
-- Todas las fechas son relativas a public.hoy(): el archivo pasa cualquier día
-- (a propósito NO usa literales — un test de "día 28" con fechas fijas solo
-- probaría un mes en particular, y febrero/meses de 31 días son justamente
-- donde el cálculo calendario y el de 28 días divergen).
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mes_de_tratamiento_28_dias.sql
--   (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- PREREQUISITES: schema aplicado (incluida 20261005190000) + catálogo del seed
-- (roles, estados, causas, algoritmos, modalidades, contenidos de los 5 tipos).
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 + 2 — set_entregas_plan recompute + update_etapa_diagnostico
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_pendiente_etapa uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_modalidad_otra uuid := 'b2000003-0000-0000-0000-000000000000';
  v_cantidad_niveles int;
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_plan           jsonb;
  v_fecha_inicio   date;
  v_total          int;
  v_ok             int;
begin
  raise notice '--- BLOCK 1: iniciar_tratamiento agenda el nivel n en public.hoy() + 28 * n ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_pendiente_etapa from public.estados_etapa where codigo = 'pendiente';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad_id;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mt28-b1-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente MT28 B1', '1990-01-01', 'mt28-b1-paciente@example.test', '+541155550181', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy());

  -- Etapa creada pero sin arrancar: fecha_inicio null, niveles sin agendar
  -- (como la dejan register_paciente / iniciar_nueva_etapa).
  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, null, v_pendiente_etapa
  ) returning id into v_etapa_id;

  insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
  select v_etapa_id, g.n, null
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- Plan completo: las (cantidad_niveles * 4) semanas con sus 5 slots, cada
  -- uno con un contenido del tipo que exige su orden (DEC-8).
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

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);
  perform public.iniciar_tratamiento(v_etapa_id, v_plan);

  select e.fecha_inicio into v_fecha_inicio
    from public.etapas_tratamiento as e
   where e.id = v_etapa_id;
  assert v_fecha_inicio = public.hoy(),
    format('BLOCK 1: iniciar_tratamiento debe arrancar la etapa hoy, fecha_inicio = %L', v_fecha_inicio);

  select count(*),
         count(*) filter (
           where n.fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel
         )
    into v_total, v_ok
    from public.niveles as n
   where n.etapa_id = v_etapa_id;
  assert v_total = v_cantidad_niveles and v_ok = v_total,
    format('BLOCK 1: %s de %s niveles agendados en public.hoy() + 28 * n', v_ok, v_total);

  -- El último nivel vence el día en que termina el contenido (16 semanas =
  -- 112 días), no ~9 días después como con meses calendario.
  assert (
    select n.fecha_seguimiento_esperada = public.hoy() + 112
      from public.niveles as n
     where n.etapa_id = v_etapa_id and n.numero_nivel = 4
  ), 'BLOCK 1: el nivel 4 debe vencer el día 112 (fin de la semana 16)';

  raise notice 'BLOCK 1 PASSED: recompute al completar el plan = public.hoy() + 28 * n';

  raise notice '--- BLOCK 2: update_etapa_diagnostico regenera la grilla en fecha_inicio + 28 * n ---';

  -- Etapa en curso desde hace 10 días, sin progreso (pasa el gate de frescura).
  update public.etapas_tratamiento
     set fecha_inicio = public.hoy() - 10
   where id = v_etapa_id;

  perform public.update_etapa_diagnostico(
    v_paciente_id, v_causa_id, v_algoritmo_id, v_modalidad_otra, '{}'::uuid[], '[]'::jsonb
  );

  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad_otra;

  select count(*),
         count(*) filter (
           where n.fecha_seguimiento_esperada = (public.hoy() - 10) + 28 * n.numero_nivel
         )
    into v_total, v_ok
    from public.niveles as n
   where n.etapa_id = v_etapa_id;
  assert v_total = v_cantidad_niveles and v_ok = v_total,
    format('BLOCK 2: %s de %s niveles regenerados en fecha_inicio + 28 * n', v_ok, v_total);

  raise notice 'BLOCK 2 PASSED: cambiar la modalidad regenera la grilla en fecha_inicio + 28 * n';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — get_admin_dashboard_stats: día 27 → mes 1; día 28 → mes 2
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_admin_user     uuid := gen_random_uuid();
  v_admin_role     uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_mes1_base      int;
  v_mes2_base      int;
  v_mes1           int;
  v_mes2           int;
begin
  raise notice '--- BLOCK 3: get_admin_dashboard_stats cuenta el mes en bloques de 28 días ---';

  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mt28-b3-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_admin_user);

  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);

  -- Línea de base: la red tal como está, antes de sumar el paciente de prueba.
  select coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '1'
         ), 0),
         coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '2'
         ), 0)
    into v_mes1_base, v_mes2_base;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente MT28 B3', '1990-01-01', 'mt28-b3-paciente@example.test', '+541155550183', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_admin_user, public.hoy() - 27);

  -- Día 27: último día de la semana 4 → todavía mes 1.
  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_admin_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 27, v_activa_etapa
  ) returning id into v_etapa_id;

  select coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '1'
         ), 0),
         coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '2'
         ), 0)
    into v_mes1, v_mes2;
  assert v_mes1 = v_mes1_base + 1 and v_mes2 = v_mes2_base,
    format('BLOCK 3: día 27 debe contar en el mes 1 (mes1 %s→%s, mes2 %s→%s)',
           v_mes1_base, v_mes1, v_mes2_base, v_mes2);

  -- Día 28: arranca la semana 5 → mes 2, aunque no haya pasado un mes calendario.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 28 where id = v_etapa_id;

  select coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '1'
         ), 0),
         coalesce((
           select (d ->> 'cantidad')::int
             from jsonb_array_elements(public.get_admin_dashboard_stats() -> 'distribucionMes') as d
            where d ->> 'label' = '2'
         ), 0)
    into v_mes1, v_mes2;
  assert v_mes1 = v_mes1_base and v_mes2 = v_mes2_base + 1,
    format('BLOCK 3: día 28 debe contar en el mes 2 (mes1 %s→%s, mes2 %s→%s)',
           v_mes1_base, v_mes1, v_mes2_base, v_mes2);

  raise notice 'BLOCK 3 PASSED: día 27 → mes 1, día 28 → mes 2';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 + 5 — derive_alertas_activas: mes_3 (día 56), fin (día 84) y
-- reinicio (< 28 días, solo etapas no-primeras)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_final_etapa    uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_cantidad_niveles int;
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_tipos          text[];
begin
  raise notice '--- BLOCK 4: mes_3 y fin saltan según bloques de 28 días ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_final_etapa from public.estados_etapa where codigo = 'finalizada';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad_id;
  assert v_cantidad_niveles = 4,
    'BLOCK 4: el fixture asume una modalidad de 4 niveles (fin = mes 4 = día 84)';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'mt28-b4-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente MT28 B4', '1990-01-01', 'mt28-b4-paciente@example.test', '+541155550184', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 400);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 55, v_activa_etapa
  ) returning id into v_etapa_id;

  -- Día 55: último día del mes 2 → ni mes_3 ni fin.
  select coalesce(array_agg(a.tipo), '{}') into v_tipos
    from public.derive_alertas_activas() as a
   where a.paciente_id = v_paciente_id and a.tipo in ('mes_3', 'fin');
  assert v_tipos = '{}', format('BLOCK 4: día 55 no debe disparar mes_3 ni fin, disparó %s', v_tipos);

  -- Día 56: arranca el mes 3 (un mes calendario todavía no llegaría a 2 completos).
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 56 where id = v_etapa_id;
  select coalesce(array_agg(a.tipo), '{}') into v_tipos
    from public.derive_alertas_activas() as a
   where a.paciente_id = v_paciente_id and a.tipo in ('mes_3', 'fin');
  assert v_tipos = '{mes_3}', format('BLOCK 4: día 56 debe disparar solo mes_3, disparó %s', v_tipos);

  -- Día 83: último día del mes 3.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 83 where id = v_etapa_id;
  select coalesce(array_agg(a.tipo), '{}') into v_tipos
    from public.derive_alertas_activas() as a
   where a.paciente_id = v_paciente_id and a.tipo in ('mes_3', 'fin');
  assert v_tipos = '{mes_3}', format('BLOCK 4: día 83 debe seguir en mes_3, disparó %s', v_tipos);

  -- Día 84: arranca el mes 4, el último → fin (y mes_3 se apaga).
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 84 where id = v_etapa_id;
  select coalesce(array_agg(a.tipo), '{}') into v_tipos
    from public.derive_alertas_activas() as a
   where a.paciente_id = v_paciente_id and a.tipo in ('mes_3', 'fin');
  assert v_tipos = '{fin}', format('BLOCK 4: día 84 debe disparar solo fin, disparó %s', v_tipos);

  -- Pasado el final del plan el mes queda topado en cantidad_niveles → sigue fin.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 300 where id = v_etapa_id;
  select coalesce(array_agg(a.tipo), '{}') into v_tipos
    from public.derive_alertas_activas() as a
   where a.paciente_id = v_paciente_id and a.tipo in ('mes_3', 'fin');
  assert v_tipos = '{fin}', format('BLOCK 4: pasado el plan debe seguir en fin, disparó %s', v_tipos);

  raise notice 'BLOCK 4 PASSED: mes_3 del día 56 al 83, fin desde el día 84';

  raise notice '--- BLOCK 5: reinicio dispara con menos de 28 días y no con 28 ---';

  -- Primera etapa (ordinal 1) recién arrancada: NO es un reinicio.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 5 where id = v_etapa_id;
  assert not exists (
    select 1 from public.derive_alertas_activas() as a
     where a.paciente_id = v_paciente_id and a.tipo = 'reinicio'
  ), 'BLOCK 5: la primera etapa de un paciente nunca dispara reinicio';

  -- La cerramos en el pasado y abrimos una segunda (ordinal 2) en el día 27.
  update public.etapas_tratamiento
     set fecha_inicio = public.hoy() - 300,
         fecha_finalizacion = public.hoy() - 100,
         estado_id = v_final_etapa
   where id = v_etapa_id;

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 27, v_activa_etapa
  ) returning id into v_etapa_id;

  assert exists (
    select 1 from public.derive_alertas_activas() as a
     where a.paciente_id = v_paciente_id and a.tipo = 'reinicio' and a.valor = 2
  ), 'BLOCK 5: una segunda etapa en su día 27 debe disparar reinicio';

  -- Arrancada hoy: también.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() where id = v_etapa_id;
  assert exists (
    select 1 from public.derive_alertas_activas() as a
     where a.paciente_id = v_paciente_id and a.tipo = 'reinicio'
  ), 'BLOCK 5: una segunda etapa arrancada hoy debe disparar reinicio';

  -- Día 28: terminó el primer mes de tratamiento → se apaga sola.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 28 where id = v_etapa_id;
  assert not exists (
    select 1 from public.derive_alertas_activas() as a
     where a.paciente_id = v_paciente_id and a.tipo = 'reinicio'
  ), 'BLOCK 5: en el día 28 reinicio ya no debe dispararse';

  raise notice 'BLOCK 5 PASSED: reinicio dispara los primeros 28 días de una etapa no-primera';
end;
$$;

rollback;
