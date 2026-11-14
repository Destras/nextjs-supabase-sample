-- =============================================================================
-- plan_borrador.sql — Assertion tests for planBorrador / Epic 0, Task 0.1
-- =============================================================================
-- Coverage: DevSpec §11 (blocks 1 to 6) — guardar el plan nunca arranca el
-- tratamiento; iniciar_tratamiento es el acto explícito que lo arranca.
--   BLOCK 1 — set_entregas_plan con plan vacío, parcial y completo deja
--             fecha_inicio nula y la etapa 'pendiente'; sobre una etapa cerrada
--             falla con etapa_cerrada y no toca el plan.
--   BLOCK 2 — iniciar_tratamiento sin plan: fecha_inicio = hoy(), estado
--             'activa', niveles en hoy() + 28 * n, { iniciado: true, pacienteId }.
--   BLOCK 3 — segunda llamada: { iniciado: false } y la fecha no cambia.
--   BLOCK 4 — iniciar con plan: uno válido guarda y arranca; uno con
--             tipo_slot_invalido no arranca ni guarda.
--   BLOCK 5 — etapa cerrada y paciente dado de baja no se inician; un
--             terapeuta ajeno recibe no_autorizado; anon no tiene EXECUTE;
--             etapa_plan_completo ya no existe.
--   BLOCK 6 — bloqueo de semanas pasadas: con el tratamiento iniciado hace 15
--             días (semana en curso 3), cambiar las semanas 3 y 5 guarda y las
--             filas de las semanas 1 y 2 conservan su id; cambiar la 2 falla
--             con semana_pasada (detail '2') y el plan queda igual; sin iniciar
--             no hay bloqueo.
--   BLOCK 7 — get_mi_plan_semanal devuelve las 16 semanas del tratamiento con o
--             sin contenido: sin entregas, todas con piezas = [] y frases solo
--             en la semana en curso y las anteriores; con contenido solo en la
--             semana 2, solo la 2 trae piezas. (Task 3.1)
--
-- TOOLING (mirrors supabase/tests/hoy_dia_local.sql — no pgTAP): bloques
-- DO $$ ... ASSERT ... $$ dentro de begin/rollback. Un assert que falla aborta
-- el script con ERROR; cada bloque que pasa imprime "BLOCK N PASSED". La sesión
-- del terapeuta se simula con request.jwt.claim.sub (auth.uid()).
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/plan_borrador.sql
--   (local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
--
-- PREREQUISITES: schema aplicado (incluida 20261014180000) + catálogo del seed
-- (roles, estados, causas, algoritmos, modalidades, contenidos de los 5 tipos).
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================


-- Fixture compartido (vive en pg_temp: se va con la sesión). Crea un terapeuta
-- y un paciente con su etapa SIN ARRANCAR, y deja la sesión como ese terapeuta.
create or replace function pg_temp.fixture(p_tag text)
returns table (terapeuta_id uuid, paciente_id uuid, etapa_id uuid)
language plpgsql
as $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
begin
  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    format('pb-%s-terapeuta@example.test', p_tag), crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  v_paciente_id := public.register_paciente(
    format('Paciente PB %s', p_tag), '1990-01-01',
    format('pb-%s-paciente@example.test', p_tag), '+541155550' || lpad((random() * 999)::int::text, 3, '0'),
    v_causa_id, v_algoritmo_id, v_modalidad_id, '{}'::uuid[], '[]'::jsonb, null
  );

  return query
    select v_terapeuta_user, v_paciente_id, e.id
      from public.etapas_tratamiento as e
     where e.paciente_id = v_paciente_id;
end;
$$;

-- Plan completo: las (cantidad_niveles * 4) semanas con sus 5 slots.
create or replace function pg_temp.plan_completo(p_etapa_id uuid)
returns jsonb
language sql
as $$
  select jsonb_agg(
           jsonb_build_object(
             'semana', s.semana,
             'orden', t.orden,
             'contenido_id', (
               select c.id from public.contenidos as c where c.tipo = t.tipo limit 1
             )
           )
         )
    from generate_series(1, public.semanas_de_etapa(p_etapa_id)) as s(semana)
   cross join (
     values (1, 'video'), (2, 'audio'), (3, 'egregor'), (4, 'cma'), (5, 'ic')
   ) as t(orden, tipo);
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — guardar nunca arranca
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fx          record;
  v_fecha       date;
  v_estado      text;
  v_filas       int;
  v_plan        jsonb;
  v_parcial     jsonb;
  v_sqlstate    text;
  v_msg         text;
begin
  raise notice '--- BLOCK 1: guardar no arranca el tratamiento ---';

  select * into v_fx from pg_temp.fixture('b1');
  v_plan := pg_temp.plan_completo(v_fx.etapa_id);
  v_parcial := jsonb_build_array(v_plan -> 0, v_plan -> 1);

  -- Vacío, parcial y completo: ninguno arranca.
  perform public.set_entregas_plan(v_fx.etapa_id, '[]'::jsonb);
  perform public.set_entregas_plan(v_fx.etapa_id, v_parcial);
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = 2, format('BLOCK 1: el plan parcial debe guardar 2 filas, guardó %s', v_filas);
  perform public.set_entregas_plan(v_fx.etapa_id, v_plan);
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = jsonb_array_length(v_plan), 'BLOCK 1: el plan completo debe guardarse entero';

  select e.fecha_inicio, ee.codigo into v_fecha, v_estado
    from public.etapas_tratamiento as e
    join public.estados_etapa as ee on ee.id = e.estado_id
   where e.id = v_fx.etapa_id;
  assert v_fecha is null, format('BLOCK 1: guardar no debe fijar fecha_inicio, quedó %L', v_fecha);
  assert v_estado = 'pendiente', format('BLOCK 1: la etapa debe seguir pendiente, quedó %L', v_estado);

  select count(*) into v_filas
    from public.niveles as n
   where n.etapa_id = v_fx.etapa_id and n.fecha_seguimiento_esperada is not null;
  assert v_filas = 0, 'BLOCK 1: guardar no debe agendar los niveles';

  -- Etapa cerrada: etapa_cerrada y el plan no cambia.
  update public.etapas_tratamiento set fecha_finalizacion = public.hoy() where id = v_fx.etapa_id;
  begin
    perform public.set_entregas_plan(v_fx.etapa_id, '[]'::jsonb);
    assert false, 'BLOCK 1: guardar sobre una etapa cerrada debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text;
    assert v_sqlstate = 'P0001' and v_msg = 'etapa_cerrada',
      format('BLOCK 1: se esperaba etapa_cerrada (P0001), llegó %s / %s', v_sqlstate, v_msg);
  end;
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = jsonb_array_length(v_plan), 'BLOCK 1: el plan no debe cambiar en una etapa cerrada';

  raise notice 'BLOCK 1 PASSED: guardar vacío/parcial/completo no arranca; etapa cerrada rechaza';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 + 3 — iniciar sin plan, y la segunda llamada
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fx          record;
  v_fecha       date;
  v_estado      text;
  v_res         jsonb;
  v_total       int;
  v_ok          int;
  v_filas       int;
begin
  raise notice '--- BLOCK 2: iniciar_tratamiento sin plan arranca ---';

  select * into v_fx from pg_temp.fixture('b2');

  v_res := public.iniciar_tratamiento(v_fx.etapa_id);
  assert (v_res ->> 'iniciado')::boolean is true,
    format('BLOCK 2: se esperaba iniciado=true, llegó %s', v_res);
  assert (v_res ->> 'pacienteId')::uuid = v_fx.paciente_id,
    format('BLOCK 2: pacienteId incorrecto: %s', v_res);

  select e.fecha_inicio, ee.codigo into v_fecha, v_estado
    from public.etapas_tratamiento as e
    join public.estados_etapa as ee on ee.id = e.estado_id
   where e.id = v_fx.etapa_id;
  assert v_fecha = public.hoy(), format('BLOCK 2: fecha_inicio = %L, se esperaba hoy()', v_fecha);
  assert v_estado = 'activa', format('BLOCK 2: estado = %L, se esperaba activa', v_estado);

  select count(*),
         count(*) filter (where n.fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel)
    into v_total, v_ok
    from public.niveles as n
   where n.etapa_id = v_fx.etapa_id;
  assert v_total > 0 and v_ok = v_total,
    format('BLOCK 2: %s de %s niveles agendados en hoy() + 28 * n', v_ok, v_total);

  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = 0, 'BLOCK 2: iniciar sin plan no debe crear entregas';

  raise notice 'BLOCK 2 PASSED: iniciar con el plan vacío arranca y agenda los niveles';

  raise notice '--- BLOCK 3: la segunda llamada no re-arranca ---';

  -- Se corre la fecha hacia atrás para que un re-arranque se note.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 5 where id = v_fx.etapa_id;

  v_res := public.iniciar_tratamiento(v_fx.etapa_id);
  assert (v_res ->> 'iniciado')::boolean is false,
    format('BLOCK 3: se esperaba iniciado=false, llegó %s', v_res);
  assert (v_res ->> 'pacienteId')::uuid = v_fx.paciente_id, 'BLOCK 3: pacienteId incorrecto';

  select e.fecha_inicio into v_fecha from public.etapas_tratamiento as e where e.id = v_fx.etapa_id;
  assert v_fecha = public.hoy() - 5, format('BLOCK 3: la fecha cambió a %L', v_fecha);

  raise notice 'BLOCK 3 PASSED: iniciado=false y la fecha no cambia';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 — iniciar con plan
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fx        record;
  v_fecha     date;
  v_res       jsonb;
  v_filas     int;
  v_plan      jsonb;
  v_malo      jsonb;
  v_sqlstate  text;
  v_msg       text;
begin
  raise notice '--- BLOCK 4: iniciar_tratamiento con plan ---';

  -- Plan inválido (un audio en el slot 1 = video): no arranca ni guarda.
  select * into v_fx from pg_temp.fixture('b4a');
  v_malo := jsonb_build_array(jsonb_build_object(
    'semana', 1, 'orden', 1,
    'contenido_id', (select c.id from public.contenidos as c where c.tipo = 'audio' limit 1)
  ));
  begin
    perform public.iniciar_tratamiento(v_fx.etapa_id, v_malo);
    assert false, 'BLOCK 4: un plan con tipo de slot inválido debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text;
    assert v_sqlstate = '23514' and v_msg = 'tipo_slot_invalido',
      format('BLOCK 4: se esperaba tipo_slot_invalido (23514), llegó %s / %s', v_sqlstate, v_msg);
  end;
  select e.fecha_inicio into v_fecha from public.etapas_tratamiento as e where e.id = v_fx.etapa_id;
  assert v_fecha is null, 'BLOCK 4: tipo_slot_invalido no debe arrancar el tratamiento';
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = 0, 'BLOCK 4: tipo_slot_invalido no debe guardar el plan';

  -- Plan válido: guarda y arranca juntos.
  v_plan := pg_temp.plan_completo(v_fx.etapa_id);
  v_res := public.iniciar_tratamiento(v_fx.etapa_id, v_plan);
  assert (v_res ->> 'iniciado')::boolean is true, format('BLOCK 4: se esperaba iniciado=true, llegó %s', v_res);
  select e.fecha_inicio into v_fecha from public.etapas_tratamiento as e where e.id = v_fx.etapa_id;
  assert v_fecha = public.hoy(), 'BLOCK 4: el plan válido debe arrancar hoy';
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = jsonb_array_length(v_plan), 'BLOCK 4: el plan válido debe guardarse entero';

  raise notice 'BLOCK 4 PASSED: plan válido guarda y arranca; inválido no hace ninguna de las dos';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5 — etapa cerrada, baja, authz y privilegios
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fx        record;
  v_otro      record;
  v_estado_baja uuid;
  v_fecha     date;
  v_sqlstate  text;
  v_msg       text;
begin
  raise notice '--- BLOCK 5: casos que no se pueden iniciar ---';

  -- Etapa cerrada.
  select * into v_fx from pg_temp.fixture('b5a');
  update public.etapas_tratamiento set fecha_finalizacion = public.hoy() where id = v_fx.etapa_id;
  begin
    perform public.iniciar_tratamiento(v_fx.etapa_id);
    assert false, 'BLOCK 5: iniciar una etapa cerrada debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text;
    assert v_sqlstate = 'P0001' and v_msg = 'etapa_cerrada',
      format('BLOCK 5: se esperaba etapa_cerrada (P0001), llegó %s / %s', v_sqlstate, v_msg);
  end;
  select e.fecha_inicio into v_fecha from public.etapas_tratamiento as e where e.id = v_fx.etapa_id;
  assert v_fecha is null, 'BLOCK 5: la etapa cerrada no debe arrancar';

  -- Paciente dado de baja.
  select * into v_fx from pg_temp.fixture('b5b');
  select id into v_estado_baja from public.estados_paciente where codigo = 'baja_voluntaria';
  update public.pacientes set estado_id = v_estado_baja where id = v_fx.paciente_id;
  begin
    perform public.iniciar_tratamiento(v_fx.etapa_id);
    assert false, 'BLOCK 5: iniciar el tratamiento de un paciente de baja debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text;
    assert v_sqlstate = 'P0001' and v_msg = 'paciente_dado_de_baja',
      format('BLOCK 5: se esperaba paciente_dado_de_baja (P0001), llegó %s / %s', v_sqlstate, v_msg);
  end;

  -- Terapeuta ajeno: la etapa b5b es de v_fx; el fixture siguiente deja la
  -- sesión como otro terapeuta.
  select * into v_otro from pg_temp.fixture('b5c');
  begin
    perform public.iniciar_tratamiento(v_fx.etapa_id);
    assert false, 'BLOCK 5: un terapeuta ajeno no debe poder iniciar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text;
    assert v_sqlstate = '42501' and v_msg = 'no_autorizado',
      format('BLOCK 5: se esperaba no_autorizado (42501), llegó %s / %s', v_sqlstate, v_msg);
  end;

  -- Sin sesión: tampoco (guard NULL-safe).
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.iniciar_tratamiento(v_otro.etapa_id);
    assert false, 'BLOCK 5: sin sesión no debe poder iniciar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    assert v_sqlstate = '42501', format('BLOCK 5: sin sesión se esperaba 42501, llegó %s', v_sqlstate);
  end;

  -- Etapa inexistente.
  begin
    perform public.iniciar_tratamiento(gen_random_uuid());
    assert false, 'BLOCK 5: una etapa inexistente debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    assert v_sqlstate = 'P0002', format('BLOCK 5: se esperaba P0002, llegó %s', v_sqlstate);
  end;

  -- Privilegios y limpieza del seam viejo.
  assert has_function_privilege('authenticated', 'public.iniciar_tratamiento(uuid, jsonb)', 'execute'),
    'BLOCK 5: authenticated debe poder ejecutar iniciar_tratamiento';
  assert not has_function_privilege('anon', 'public.iniciar_tratamiento(uuid, jsonb)', 'execute'),
    'BLOCK 5: anon no debe poder ejecutar iniciar_tratamiento';
  assert not has_function_privilege('anon', 'public.set_entregas_plan(uuid, jsonb)', 'execute'),
    'BLOCK 5: anon no debe poder ejecutar set_entregas_plan';
  assert not exists (
    select 1 from pg_catalog.pg_proc as p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'etapa_plan_completo'
  ), 'BLOCK 5: etapa_plan_completo ya no debe existir';

  raise notice 'BLOCK 5 PASSED: cerrada, baja, ajeno, sin sesión, inexistente, privilegios';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6 — bloqueo de semanas pasadas
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fx         record;
  v_video_a    uuid;
  v_video_b    uuid;
  v_plan       jsonb;
  v_cambia_35  jsonb;
  v_cambia_2   jsonb;
  v_ids_antes  uuid[];
  v_ids_desp   uuid[];
  v_filas      int;
  v_sin_cambio int;
  v_sqlstate   text;
  v_msg        text;
  v_detail     text;
begin
  raise notice '--- BLOCK 6: bloqueo de semanas pasadas ---';

  select c.id into v_video_a from public.contenidos as c where c.tipo = 'video' order by c.id limit 1;
  select c.id into v_video_b from public.contenidos as c where c.tipo = 'video' order by c.id limit 1 offset 1;
  assert v_video_b is not null, 'BLOCK 6: el test necesita al menos 2 contenidos de tipo video';

  -- Etapa iniciada hace 15 días: semana en curso = floor(15 / 7) + 1 = 3.
  select * into v_fx from pg_temp.fixture('b6a');
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 15 where id = v_fx.etapa_id;

  -- Plan con un video en cada una de las semanas 1 a 5.
  select jsonb_agg(jsonb_build_object('semana', g, 'orden', 1, 'contenido_id', v_video_a) order by g)
    into v_plan from generate_series(1, 5) as g;
  -- El mismo plan cambiando las semanas 3 y 5.
  select jsonb_agg(jsonb_build_object('semana', g, 'orden', 1,
           'contenido_id', case when g in (3, 5) then v_video_b else v_video_a end) order by g)
    into v_cambia_35 from generate_series(1, 5) as g;
  -- El mismo plan cambiando la semana 2 (pasada).
  select jsonb_agg(jsonb_build_object('semana', g, 'orden', 1,
           'contenido_id', case when g = 2 then v_video_b else v_video_a end) order by g)
    into v_cambia_2 from generate_series(1, 5) as g;

  -- Estado inicial: las 5 semanas ya guardadas (a mano, sin pasar por el RPC).
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden)
  select v_fx.etapa_id, (g - 1) * 7, v_video_a, 1 from generate_series(1, 5) as g;
  select array_agg(ep.id order by ep.dia_offset) into v_ids_antes
    from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id and ep.dia_offset < 14;

  -- Cambiar la 3 y la 5 pasa, y las semanas 1 y 2 conservan su id.
  perform public.set_entregas_plan(v_fx.etapa_id, v_cambia_35);
  select array_agg(ep.id order by ep.dia_offset) into v_ids_desp
    from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id and ep.dia_offset < 14;
  assert v_ids_antes = v_ids_desp, 'BLOCK 6: las filas de las semanas 1 y 2 deben conservar su id';
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = 5, format('BLOCK 6: deben quedar 5 filas, hay %s', v_filas);
  select count(*) into v_filas from public.entregas_plan as ep
   where ep.etapa_id = v_fx.etapa_id and ep.dia_offset in (14, 28) and ep.contenido_id = v_video_b;
  assert v_filas = 2, 'BLOCK 6: las semanas 3 y 5 deben tener el contenido nuevo';

  -- Cambiar la semana 2 falla con semana_pasada / detail '2' y no guarda nada.
  begin
    perform public.set_entregas_plan(v_fx.etapa_id, v_cambia_2);
    assert false, 'BLOCK 6: cambiar una semana pasada debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text, v_detail = pg_exception_detail;
    assert v_sqlstate = 'P0001' and v_msg = 'semana_pasada' and v_detail = '2',
      format('BLOCK 6: se esperaba semana_pasada (P0001) detail 2, llegó %s / %s / %s', v_sqlstate, v_msg, v_detail);
  end;
  select count(*) into v_sin_cambio from public.entregas_plan as ep
   where ep.etapa_id = v_fx.etapa_id and ep.dia_offset = 7 and ep.contenido_id = v_video_a;
  assert v_sin_cambio = 1, 'BLOCK 6: el plan debe quedar igual tras semana_pasada';
  select count(*) into v_filas from public.entregas_plan as ep where ep.etapa_id = v_fx.etapa_id;
  assert v_filas = 5, 'BLOCK 6: semana_pasada no debe borrar nada';

  -- Borrar una semana pasada (payload sin la semana 1) también es un cambio.
  begin
    perform public.set_entregas_plan(v_fx.etapa_id, v_cambia_35 - 0);  -- jsonb - 0 quita el primer ítem (semana 1)
    assert false, 'BLOCK 6: omitir una semana pasada debe fallar';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_msg = message_text, v_detail = pg_exception_detail;
    assert v_msg = 'semana_pasada' and v_detail = '1',
      format('BLOCK 6: se esperaba semana_pasada detail 1, llegó %s / %s', v_msg, v_detail);
  end;

  -- Sin iniciar: no hay bloqueo, todo se puede reescribir.
  select * into v_fx from pg_temp.fixture('b6b');
  perform public.set_entregas_plan(v_fx.etapa_id, v_plan);
  perform public.set_entregas_plan(v_fx.etapa_id, v_cambia_2);
  select count(*) into v_filas from public.entregas_plan as ep
   where ep.etapa_id = v_fx.etapa_id and ep.dia_offset = 7 and ep.contenido_id = v_video_b;
  assert v_filas = 1, 'BLOCK 6: sin iniciar se puede cambiar cualquier semana';

  raise notice 'BLOCK 6 PASSED: semanas pasadas bloqueadas, 3 y 5 editables, sin iniciar sin bloqueo';
end;
$$;

do $$
declare
  v_fx        record;
  v_user      uuid := gen_random_uuid();
  v_video     uuid;
  v_plan      jsonb;
  v_res       jsonb;
  v_n         int;
  v_piezas    int;
  v_frases_ok int;
  v_futuras   int;
begin
  raise notice '--- BLOCK 7: get_mi_plan_semanal con las 16 semanas ---';

  select c.id into v_video from public.contenidos as c where c.tipo = 'video' order by c.id limit 1;
  assert v_video is not null, 'BLOCK 7: el test necesita un contenido de tipo video';

  -- Paciente con cuenta y tratamiento iniciado sin entregas.
  select * into v_fx from pg_temp.fixture('b7');
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'pb-b7-cuenta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.pacientes set user_id = v_user where id = v_fx.paciente_id;
  perform public.iniciar_tratamiento(v_fx.etapa_id);
  -- Iniciado hace 10 días: semana en curso = floor(10 / 7) + 1 = 2.
  update public.etapas_tratamiento set fecha_inicio = public.hoy() - 10 where id = v_fx.etapa_id;

  -- Desde acá la sesión es el paciente.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_res := public.get_mi_plan_semanal();
  assert jsonb_array_length(v_res) = 16, format('BLOCK 7: se esperaban 16 semanas, hay %s', jsonb_array_length(v_res));
  select count(*) into v_piezas from jsonb_array_elements(v_res) as e where jsonb_array_length(e -> 'piezas') > 0;
  assert v_piezas = 0, 'BLOCK 7: sin entregas todas las semanas deben traer piezas = []';
  -- Semana en curso (2) y anterior (1): con frases. Futuras (3..16): frases = [].
  select count(*) into v_frases_ok from jsonb_array_elements(v_res) as e
   where (e ->> 'semana')::int <= 2 and jsonb_array_length(e -> 'frases') > 0;
  assert v_frases_ok = 2, format('BLOCK 7: las semanas 1 y 2 deben traer frases, %s las traen', v_frases_ok);
  select count(*) into v_futuras from jsonb_array_elements(v_res) as e
   where (e ->> 'semana')::int > 2 and jsonb_array_length(e -> 'frases') = 0 and e ->> 'estadoSemana' = 'futura';
  assert v_futuras = 14, format('BLOCK 7: las 14 semanas futuras deben traer frases = [], %s lo cumplen', v_futuras);

  -- Contenido solo en la semana 2 (dia_offset 7).
  reset role;
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden) values (v_fx.etapa_id, 7, v_video, 1);
  set local role authenticated;

  v_res := public.get_mi_plan_semanal();
  assert jsonb_array_length(v_res) = 16, 'BLOCK 7: con contenido en la semana 2 siguen siendo 16 semanas';
  select count(*) into v_piezas from jsonb_array_elements(v_res) as e where jsonb_array_length(e -> 'piezas') > 0;
  assert v_piezas = 1, format('BLOCK 7: solo la semana 2 debe traer piezas, %s las traen', v_piezas);
  select count(*) into v_n from jsonb_array_elements(v_res) as e
   where (e ->> 'semana')::int = 2 and jsonb_array_length(e -> 'piezas') = 1;
  assert v_n = 1, 'BLOCK 7: la pieza debe estar en la semana 2';

  reset role;
  raise notice 'BLOCK 7 PASSED: 16 semanas con y sin contenido, frases solo hasta la semana en curso';
end;
$$;

rollback;
