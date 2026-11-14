do $$
declare
  -- =====================================================
  -- catalog ids
  -- =====================================================

  -- roles
  v_rol_admin     uuid := 'a1000001-0000-0000-0000-000000000000';
  v_rol_terapeuta uuid := 'a1000002-0000-0000-0000-000000000000';
  v_rol_paciente  uuid := 'a1000003-0000-0000-0000-000000000000';

  -- estados terapeuta (catálogo poblado por la migración seed_estados_terapeuta; ver lookup en sección 2)
  v_est_ter_activo     uuid;

  -- estados paciente
  v_est_pac_activo  uuid := 'a3000001-0000-0000-0000-000000000000';
  v_est_pac_pausado uuid := 'a3000002-0000-0000-0000-000000000000';

  -- estados etapa
  v_est_eta_activa    uuid := 'a4000001-0000-0000-0000-000000000000';
  v_est_eta_final     uuid := 'a4000002-0000-0000-0000-000000000000';
  v_est_eta_abandon   uuid := 'a4000003-0000-0000-0000-000000000000';

  -- causas, algoritmos y bloqueos: catálogo de ejemplo generado en la migración
  -- supabase/migrations/20260719120100_seed_clinical_catalog.sql (corre
  -- antes que este archivo, como toda migración). Los pacientes los
  -- referencian por `codigo` (CAU-NN / ALG-NN / BLQ-NN) más abajo, no por
  -- variable.

  -- tipos disco
  v_disco_rio    uuid := 'a8000001-0000-0000-0000-000000000000';
  v_disco_bosque uuid := 'a8000002-0000-0000-0000-000000000000';
  v_disco_agua   uuid := 'a8000003-0000-0000-0000-000000000000';

  -- alfabetos
  v_alfa_telurico    uuid := 'a9000102-0000-0000-0000-000000000000';
  v_alfa_exorcistico uuid := 'a9000103-0000-0000-0000-000000000000';
  v_alfa_cosmico     uuid := 'a9000104-0000-0000-0000-000000000000';
  v_alfa_firmas      uuid := 'a9000107-0000-0000-0000-000000000000';

  -- contenidos
  v_cont_1 uuid := 'b1000001-0000-0000-0000-000000000000';
  v_cont_2 uuid := 'b1000002-0000-0000-0000-000000000000';
  v_cont_4 uuid := 'b1000004-0000-0000-0000-000000000000';
  v_cont_5 uuid := 'b1000005-0000-0000-0000-000000000000';
  -- Los tres tipos que el plan necesita además de video/audio desde el PR #52
  -- (grilla de 5 slots). Mismos ids que supabase/seeds/03_contenidos_cinco_tipos.local.sql,
  -- para que ese archivo siga siendo un superconjunto compatible y no duplique filas.
  v_cont_egr uuid := 'b1000010-0000-0000-0000-000000000000';
  v_cont_cma uuid := 'b1000011-0000-0000-0000-000000000000';
  v_cont_ic  uuid := 'b1000012-0000-0000-0000-000000000000';

  -- modalidades (4 canónicas: 16/32 × Río/Bosque)
  v_mod_bosque    uuid := 'b2000002-0000-0000-0000-000000000000'; -- 16 Bosque
  v_mod_rio_32    uuid := 'b2000003-0000-0000-0000-000000000000'; -- 32 Río
  v_mod_rio_16    uuid := 'b2000004-0000-0000-0000-000000000000'; -- 16 Río
  v_mod_bosque_32 uuid := 'b2000005-0000-0000-0000-000000000000'; -- 32 Bosque

  -- =====================================================
  -- user ids (auth.users + profiles)
  -- =====================================================
  v_user_admin     uuid := 'c0000001-0000-0000-0000-000000000000';
  v_user_admin_ter uuid := 'c0000002-0000-0000-0000-000000000000';
  v_user_ter1      uuid := 'c0000003-0000-0000-0000-000000000000';
  v_user_ter2      uuid := 'c0000004-0000-0000-0000-000000000000';
  v_user_pac1      uuid := 'c0000005-0000-0000-0000-000000000000';
  v_user_pac2      uuid := 'c0000006-0000-0000-0000-000000000000';
  v_user_pac3      uuid := 'c0000007-0000-0000-0000-000000000000';
  v_user_pac4      uuid := 'c0000008-0000-0000-0000-000000000000';

  -- pacientes pks (tabla propia)
  -- pac1-4: pacientes con user_id (loguean). pac5-12: solo data (sin auth, no loguean)
  v_pac1  uuid := 'd0000001-0000-0000-0000-000000000000';
  v_pac2  uuid := 'd0000002-0000-0000-0000-000000000000';
  v_pac3  uuid := 'd0000003-0000-0000-0000-000000000000';
  v_pac4  uuid := 'd0000004-0000-0000-0000-000000000000';
  v_pac5  uuid := 'd0000005-0000-0000-0000-000000000000';
  v_pac6  uuid := 'd0000006-0000-0000-0000-000000000000';
  v_pac7  uuid := 'd0000007-0000-0000-0000-000000000000';
  v_pac8  uuid := 'd0000008-0000-0000-0000-000000000000';
  v_pac9  uuid := 'd0000009-0000-0000-0000-000000000000';
  v_pac10 uuid := 'd000000a-0000-0000-0000-000000000000';
  v_pac11 uuid := 'd000000b-0000-0000-0000-000000000000';
  v_pac12 uuid := 'd000000c-0000-0000-0000-000000000000';

  -- etapas de tratamiento
  v_etapa1  uuid := 'e0000001-0000-0000-0000-000000000000';
  v_etapa2  uuid := 'e0000002-0000-0000-0000-000000000000';
  v_etapa3  uuid := 'e0000003-0000-0000-0000-000000000000';
  v_etapa4  uuid := 'e0000004-0000-0000-0000-000000000000';
  v_etapa5  uuid := 'e0000005-0000-0000-0000-000000000000';
  v_etapa6  uuid := 'e0000006-0000-0000-0000-000000000000';
  v_etapa7  uuid := 'e0000007-0000-0000-0000-000000000000';
  v_etapa8  uuid := 'e0000008-0000-0000-0000-000000000000';
  v_etapa9  uuid := 'e0000009-0000-0000-0000-000000000000';
  v_etapa10 uuid := 'e000000a-0000-0000-0000-000000000000';
  v_etapa11 uuid := 'e000000b-0000-0000-0000-000000000000';
  v_etapa12 uuid := 'e000000c-0000-0000-0000-000000000000';

  -- niveles (4 por etapa)
  v_nivel_1_1 uuid := 'f0000001-0000-0000-0000-000000000000';
  v_nivel_1_2 uuid := 'f0000002-0000-0000-0000-000000000000';
  v_nivel_1_3 uuid := 'f0000003-0000-0000-0000-000000000000';
  v_nivel_1_4 uuid := 'f0000004-0000-0000-0000-000000000000';
  v_nivel_2_1 uuid := 'f0000005-0000-0000-0000-000000000000';
  v_nivel_2_2 uuid := 'f0000006-0000-0000-0000-000000000000';
  v_nivel_2_3 uuid := 'f0000007-0000-0000-0000-000000000000';
  v_nivel_2_4 uuid := 'f0000008-0000-0000-0000-000000000000';
  v_nivel_3_1 uuid := 'f0000009-0000-0000-0000-000000000000';
  v_nivel_3_2 uuid := 'f000000a-0000-0000-0000-000000000000';
  v_nivel_3_3 uuid := 'f000000b-0000-0000-0000-000000000000';
  v_nivel_3_4 uuid := 'f000000c-0000-0000-0000-000000000000';
  v_nivel_4_1 uuid := 'f000000d-0000-0000-0000-000000000000';
  v_nivel_4_2 uuid := 'f000000e-0000-0000-0000-000000000000';
  v_nivel_4_3 uuid := 'f000000f-0000-0000-0000-000000000000';
  v_nivel_4_4 uuid := 'f0000010-0000-0000-0000-000000000000';
  -- niveles de los pacientes nuevos (pac5..pac12, 4 niveles cada uno)
  v_nivel_5_1  uuid := 'f0000011-0000-0000-0000-000000000000';
  v_nivel_5_2  uuid := 'f0000012-0000-0000-0000-000000000000';
  v_nivel_5_3  uuid := 'f0000013-0000-0000-0000-000000000000';
  v_nivel_5_4  uuid := 'f0000014-0000-0000-0000-000000000000';
  v_nivel_6_1  uuid := 'f0000015-0000-0000-0000-000000000000';
  v_nivel_6_2  uuid := 'f0000016-0000-0000-0000-000000000000';
  v_nivel_6_3  uuid := 'f0000017-0000-0000-0000-000000000000';
  v_nivel_6_4  uuid := 'f0000018-0000-0000-0000-000000000000';
  v_nivel_7_1  uuid := 'f0000019-0000-0000-0000-000000000000';
  v_nivel_7_2  uuid := 'f000001a-0000-0000-0000-000000000000';
  v_nivel_7_3  uuid := 'f000001b-0000-0000-0000-000000000000';
  v_nivel_7_4  uuid := 'f000001c-0000-0000-0000-000000000000';
  v_nivel_8_1  uuid := 'f000001d-0000-0000-0000-000000000000';
  v_nivel_8_2  uuid := 'f000001e-0000-0000-0000-000000000000';
  v_nivel_8_3  uuid := 'f000001f-0000-0000-0000-000000000000';
  v_nivel_8_4  uuid := 'f0000020-0000-0000-0000-000000000000';
  v_nivel_9_1  uuid := 'f0000021-0000-0000-0000-000000000000';
  v_nivel_9_2  uuid := 'f0000022-0000-0000-0000-000000000000';
  v_nivel_9_3  uuid := 'f0000023-0000-0000-0000-000000000000';
  v_nivel_9_4  uuid := 'f0000024-0000-0000-0000-000000000000';
  v_nivel_10_1 uuid := 'f0000025-0000-0000-0000-000000000000';
  v_nivel_10_2 uuid := 'f0000026-0000-0000-0000-000000000000';
  v_nivel_10_3 uuid := 'f0000027-0000-0000-0000-000000000000';
  v_nivel_10_4 uuid := 'f0000028-0000-0000-0000-000000000000';
  v_nivel_11_1 uuid := 'f0000029-0000-0000-0000-000000000000';
  v_nivel_11_2 uuid := 'f000002a-0000-0000-0000-000000000000';
  v_nivel_11_3 uuid := 'f000002b-0000-0000-0000-000000000000';
  v_nivel_11_4 uuid := 'f000002c-0000-0000-0000-000000000000';
  v_nivel_12_1 uuid := 'f000002d-0000-0000-0000-000000000000';
  v_nivel_12_2 uuid := 'f000002e-0000-0000-0000-000000000000';
  v_nivel_12_3 uuid := 'f000002f-0000-0000-0000-000000000000';
  v_nivel_12_4 uuid := 'f0000030-0000-0000-0000-000000000000';

  -- Fixture de alertas (Epic 0, task 0.7): fecha_inicio de la etapa activa de
  -- Lucía Fernández, calculada relativa a public.hoy() (no un literal fijo).
  -- derive_alertas_activas() calcula mes_actual en bloques de 28 días desde
  -- fecha_inicio (ADR 0011); un literal fijo (p.ej. '2026-04-10') solo cae en
  -- mes_actual=3 (días 56 a 83) durante una ventana de 4 semanas y deja de
  -- disparar `mes_3` en el próximo `db reset` una vez pasada. 2 meses y 15 días
  -- son 74–77 días según el mes: siempre adentro de esa ventana.
  v_etapa5_inicio date := (public.hoy() - interval '2 months 15 days')::date;

  -- Fixture de alerta `reinicio` (Epic 3, task 3.3): paciente dedicado, separado
  -- de Valentina (que queda como demo de cierre / alerta `fin`). Su 2ª etapa
  -- arranca el día 6 del mes en curso (ver v_etapa_reinicio2_inicio más abajo):
  -- a lo sumo 25 días antes de cualquier `db reset`, o sea dentro de sus
  -- primeros 28 días → dispara `reinicio` siempre.
  v_pac_reinicio        uuid := 'd00000f4-0000-0000-0000-000000000000';
  v_etapa_reinicio1     uuid := 'e00000f4-0000-0000-0000-000000000000'; -- 1ª etapa, cerrada
  v_etapa_reinicio2     uuid := 'e00000f5-0000-0000-0000-000000000000'; -- 2ª etapa, activa (mes en curso)
  v_nivel_reinicio2_1   uuid := 'f0000031-0000-0000-0000-000000000000';
  v_nivel_reinicio2_2   uuid := 'f0000032-0000-0000-0000-000000000000';
  v_nivel_reinicio2_3   uuid := 'f0000033-0000-0000-0000-000000000000';
  v_nivel_reinicio2_4   uuid := 'f0000034-0000-0000-0000-000000000000';
  -- fecha_inicio relativa al mes en curso (no un literal fijo): sobrevive a
  -- cualquier `db reset` futuro y mantiene etapa_ordinal=2 a menos de 28
  -- días de public.hoy() (condición de `reinicio` en derive_alertas_activas,
  -- 65_alertas.sql: primer mes de tratamiento, ADR 0011 — el día 6 del mes
  -- queda como máximo 25 días atrás, o en el futuro cercano).
  v_etapa_reinicio2_inicio date := (date_trunc('month', public.hoy()) + interval '5 days')::date;

begin

  -- =====================================================
  -- 2. estados
  -- =====================================================
  -- estados_terapeuta lo siembra la migración seed_estados_terapeuta (pendiente/activo/inactivo).
  -- Acá solo levantamos el id del estado 'activo' para las FKs de terapeutas más abajo.
  select id into v_est_ter_activo
  from public.estados_terapeuta
  where codigo = 'activo';

  -- roles, estados_paciente, estados_etapa (base) y tipos_alerta ya están
  -- sembrados por 20260719120000_seed_reference_lookups.sql (y, para
  -- estados_etapa/pendiente, por 20260712040000_inicio_tratamiento_fundacion.sql).
  -- Los UUIDs de v_rol_*, v_est_pac_* y v_est_eta_* siguen declarados arriba:
  -- son los valores literales de FK que usa el árbol mock más abajo.

  -- =====================================================
  -- 3-5. causas, algoritmos y bloqueos
  -- =====================================================
  -- Movidos a la migración generada
  -- supabase/migrations/20260719120100_seed_clinical_catalog.sql (datos
  -- de ejemplo). Corre antes que este archivo.

  -- =====================================================
  -- 6-7. tipos de disco terapéutico y alfabetos
  -- =====================================================
  -- Ya sembrados por 20260719120000_seed_reference_lookups.sql. v_disco_* y
  -- v_alfa_* apuntan a los alfabetos del catálogo (a9000101..a9000108) y
  -- los usa etapa_alfabetos más abajo.

  -- =====================================================
  -- 8. contenidos
  -- =====================================================
  -- Placeholders genéricos para que el wizard y el read path tengan algo
  -- que mostrar end-to-end. El vocabulario clínico real (titulo/descripcion)
  -- y el catálogo definitivo llegan del vault — reemplazar cuando estén.
  -- Los recurso_ref apuntan a la bucket "contenidos" (gestionada via
  -- scripts/seed-media-bucket.ts, ver mini-PR chore/contenidos-storage).
  insert into public.contenidos (id, tipo, titulo, descripcion, recurso_ref, duracion_seg) values
    (v_cont_1, 'video',
     'Contenido placeholder — video 1',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     'videos/319751_medium.mp4', null),
    (v_cont_2, 'audio',
     'Contenido placeholder — audio 1',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     'audios/ummbrella-deep-abstract-ambient_snowcap-401656.mp3', null),
    (v_cont_4, 'audio',
     'Contenido placeholder — audio 2',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     'audios/bransboynd-groovy-vibe-427121.mp3', null),
    (v_cont_5, 'video',
     'Contenido placeholder — video 2',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     'videos/336149_medium.mp4', null),
    (v_cont_egr, 'egregor',
     'Contenido placeholder — egregor',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     'videos/319751_medium.mp4', 18),
    -- cma/ic son galerías: en prod se crean con create_contenido_galeria, que
    -- exige al menos una imagen. Acá van sin filas en contenido_imagenes —
    -- alcanza para que el slot tenga algo elegible en el asignador.
    (v_cont_cma, 'cma',
     'Contenido placeholder — CMA',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     null, null),
    (v_cont_ic, 'ic',
     'Contenido placeholder — IC',
     'Reemplazar con el contenido clínico real cuando llegue del vault.',
     null, null);

  -- =====================================================
  -- 9. modalidades de tratamiento
  -- =====================================================
  -- Las 4 modalidades canónicas (16/32 sesiones × Río/Bosque) ya están
  -- sembradas por 20260719120000_seed_reference_lookups.sql. v_mod_* siguen
  -- declarados arriba como valores literales de FK usados por el árbol mock.

  -- =====================================================
  -- 11-12. causa_etapas y algoritmo_etapas
  -- =====================================================
  -- Movidos a la migración generada
  -- supabase/migrations/20260719120100_seed_clinical_catalog.sql (frases
  -- de ejemplo por número de etapa).

  -- =====================================================
  -- 15. auth users
  -- handle_new_user() trigger auto-crea el perfil en public.profiles
  -- =====================================================
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_user_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_admin_ter, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin.terapeuta@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_ter1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'terapeuta1@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_ter2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'terapeuta2@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_pac1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'paciente1@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_pac2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'paciente2@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_pac3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'paciente3@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (v_user_pac4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'paciente4@clienteapp.test',
     crypt('local-seed-cgGqBIrprZGocA9r5Jxm', gen_salt('bf', 10)), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', '');

  -- =====================================================
  -- 16. update profiles (creados automáticamente por trigger)
  -- =====================================================
  update public.profiles set
    nombre   = 'Carlos Administrador',
    rol_id   = v_rol_admin,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_admin;

  update public.profiles set
    nombre   = 'Ana García',
    rol_id   = v_rol_admin,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_admin_ter;

  update public.profiles set
    nombre   = 'Laura Martínez',
    rol_id   = v_rol_terapeuta,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_ter1;

  update public.profiles set
    nombre   = 'Diego Fernández',
    rol_id   = v_rol_terapeuta,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_ter2;

  update public.profiles set
    nombre   = 'Sofía Rodríguez',
    rol_id   = v_rol_paciente,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_pac1;

  update public.profiles set
    nombre   = 'Martín López',
    rol_id   = v_rol_paciente,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_pac2;

  update public.profiles set
    nombre   = 'Valentina Torres',
    rol_id   = v_rol_paciente,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_pac3;

  update public.profiles set
    nombre   = 'Sebastián Díaz',
    rol_id   = v_rol_paciente,
    timezone = 'America/Argentina/Buenos_Aires'
  where id = v_user_pac4;

  -- =====================================================
  -- 17. terapeutas (admin, admin+ter, ter1, ter2)
  -- =====================================================
  -- Todo admin es también terapeuta (invariante de producto): el admin "puro"
  -- también recibe perfil de terapeuta para poder dar de alta pacientes
  -- (register_paciente asigna al auth.uid(), que debe existir en terapeutas).
  insert into public.terapeutas (id, matricula, especialidad, estado_id) values
    (v_user_admin,     'MT-0000', 'Terapia Energética Integral — Administración',   v_est_ter_activo),
    (v_user_admin_ter, 'MT-0001', 'Terapia Energética Integral — Nivel Avanzado',   v_est_ter_activo),
    (v_user_ter1,      'MT-0002', 'Terapia Energética Integral — Nivel Intermedio', v_est_ter_activo),
    (v_user_ter2,      'MT-0003', 'Terapia Energética Integral — Nivel Básico',     v_est_ter_activo);

  -- =====================================================
  -- 18. pacientes (con user_id vinculado)
  -- =====================================================
  insert into public.pacientes (id, user_id, nombre, telefono, email, fecha_nacimiento, contacto_alternativo, relacion_contacto, fecha_alta, estado_id) values
    (v_pac1,  v_user_pac1, 'Sofía Rodríguez',   '+54 11 2345-6789', 'sofia.rodriguez@paciente.test',  '1990-03-15', 'María Rodríguez', 'madre',   '2026-05-01', v_est_pac_activo),
    (v_pac2,  v_user_pac2, 'Martín López',      '+54 11 3456-7890', 'martin.lopez@paciente.test',     '1985-07-22', 'Julia López',     'hermana', '2026-02-10', v_est_pac_activo),
    (v_pac3,  v_user_pac3, 'Valentina Torres',  '+54 11 4567-8901', 'valentina.torres@paciente.test', '2002-11-08', 'Pedro Torres',    'padre',   '2025-12-20', v_est_pac_activo),
    (v_pac4,  v_user_pac4, 'Sebastián Díaz',    '+54 11 5678-9012', 'sebastian.diaz@paciente.test',   '1978-04-30', 'Carmen Díaz',     'madre',   '2026-01-20', v_est_pac_activo),
    -- 8 pacientes de datos (sin auth), distribuidos entre Laura y Diego
    (v_pac5,  null,        'Lucía Fernández',   '+54 11 6234-1111', 'lucia.fernandez@paciente.test',   '1992-08-12', 'Marta Fernández', 'madre',   '2026-04-10', v_est_pac_activo),
    (v_pac6,  null,        'Pedro Suárez',      '+54 11 6234-2222', 'pedro.suarez@paciente.test',      '1979-11-30', 'Andrea Suárez',   'esposa',  '2026-02-01', v_est_pac_activo),
    (v_pac7,  null,        'Camila Acosta',     '+54 11 6234-3333', 'camila.acosta@paciente.test',     '1996-05-04', 'Jorge Acosta',    'padre',   '2026-01-15', v_est_pac_activo),
    (v_pac8,  null,        'Tomás Vega',        '+54 11 6234-4444', 'tomas.vega@paciente.test',        '1983-02-18', 'Laura Vega',      'hermana', '2025-12-05', v_est_pac_activo),
    (v_pac9,  null,        'Renata Castro',     '+54 11 6234-5555', 'renata.castro@paciente.test',     '2000-09-25', 'Esteban Castro',  'padre',   '2026-05-22', v_est_pac_activo),
    (v_pac10, null,        'Joaquín Pereyra',   '+54 11 6234-6666', 'joaquin.pereyra@paciente.test',   '1988-12-03', 'Cecilia Pereyra', 'esposa',  '2026-02-25', v_est_pac_activo),
    (v_pac11, null,        'Felipe Romero',     '+54 11 6234-7777', 'felipe.romero@paciente.test',     '1991-06-15', 'Lautaro Romero',  'hermano', '2026-03-15', v_est_pac_activo),
    (v_pac12, null,        'Agustina Méndez',   '+54 11 6234-8888', 'agustina.mendez@paciente.test',   '1998-04-09', 'Silvia Méndez',   'madre',   '2026-01-20', v_est_pac_activo),
    -- Paciente dedicado — reinicio de tratamiento del mes en curso (Epic 3, task 3.3)
    (v_pac_reinicio, null, 'Marcos Ibarra',     '+54 11 6234-9999', 'marcos.ibarra@paciente.test',     '1994-02-10', 'Silvia Ibarra',   'madre',   '2025-10-01', v_est_pac_activo);

  -- =====================================================
  -- 19. asignaciones paciente (activas: fecha_hasta is null)
  -- =====================================================
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por, motivo) values
    (v_pac1,  v_user_ter1, '2026-05-01', v_user_admin_ter, 'Asignación inicial según disponibilidad de terapeuta'),
    (v_pac2,  v_user_ter1, '2026-02-10', v_user_admin_ter, 'Asignación inicial según disponibilidad de terapeuta'),
    (v_pac3,  v_user_ter2, '2025-12-20', v_user_admin_ter, 'Asignación inicial según disponibilidad de terapeuta'),
    (v_pac4,  v_user_ter2, '2026-01-20', v_user_admin_ter, 'Asignación inicial según disponibilidad de terapeuta'),
    -- Pacientes de datos: 4 para Laura (ter1) y 4 para Diego (ter2)
    (v_pac5,  v_user_ter1, '2026-04-10', v_user_admin_ter, 'Asignación inicial'),
    (v_pac6,  v_user_ter1, '2026-02-01', v_user_admin_ter, 'Asignación inicial'),
    (v_pac7,  v_user_ter1, '2026-01-15', v_user_admin_ter, 'Asignación inicial'),
    (v_pac8,  v_user_ter1, '2025-12-05', v_user_admin_ter, 'Asignación inicial'),
    (v_pac9,  v_user_ter2, '2026-05-22', v_user_admin_ter, 'Asignación inicial'),
    (v_pac10, v_user_ter2, '2026-02-25', v_user_admin_ter, 'Asignación inicial'),
    (v_pac11, v_user_ter2, '2026-03-15', v_user_admin_ter, 'Asignación inicial'),
    (v_pac12, v_user_ter2, '2026-01-20', v_user_admin_ter, 'Asignación inicial'),
    (v_pac_reinicio, v_user_ter1, '2025-10-01', v_user_admin_ter, 'Asignación inicial');

  -- =====================================================
  -- 20. etapas de tratamiento (una por paciente, activas)
  -- =====================================================
  -- causa/algoritmo referenciados por `codigo` desde el catálogo
  -- (supabase/migrations/20260719120100_seed_clinical_catalog.sql).
  -- Combinaciones de ejemplo. modalidad/alfabetos con números dentro del
  -- rango de cada uno.
  insert into public.etapas_tratamiento (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id, notas_diagnostico) values
    -- Sofía Rodríguez — recién arrancada (3 semanas atrás), ningún nivel completado
    (v_etapa1, v_pac1, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-03'), v_mod_rio_16,
     '2026-05-05', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Recién inicia el proceso, con buena disposición.'),
    -- Martín López — mitad del tratamiento, niveles 1 y 2 completados
    (v_etapa2, v_pac2, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-11'),
     (select id from public.algoritmos where codigo = 'ALG-30'), v_mod_bosque,
     '2026-02-15', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Evolución sostenida en los primeros niveles.'),
    -- Valentina Torres — tratamiento completado (todos los 4 niveles), pendiente cierre
    (v_etapa3, v_pac3, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-25'), v_mod_rio_32,
     '2025-12-26', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Proceso avanzado, con apertura progresiva de la capacidad reflexiva.'),
    -- Sebastián Díaz — en el último nivel, 3 niveles completados
    (v_etapa4, v_pac4, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-05'),
     (select id from public.algoritmos where codigo = 'ALG-16'), v_mod_bosque,
     '2026-01-26', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Alta capacidad reflexiva, en el tramo final del tratamiento.'),
    -- Lucía Fernández — fixture de alertas (task 0.7): fecha_inicio dinámica
    -- (v_etapa5_inicio, ver declare) para que mes_actual caiga en mes 3 en
    -- cualquier `db reset` futuro y dispare `mes_3`. Además dispara
    -- `score_bajo` (nivel 1 con score <= 3) y `eval_vencida` (nivel 2 sin
    -- evaluación, ver niveles más abajo).
    (v_etapa5, v_pac5, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-11'),
     (select id from public.algoritmos where codigo = 'ALG-12'), v_mod_bosque,
     v_etapa5_inicio, v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Cuadro reactivo que requiere acompañamiento cercano.'),
    -- Pedro Suárez — tendencia ascendente, niveles 1-3 completados con mejora
    (v_etapa6, v_pac6, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-39'), v_mod_bosque_32,
     '2026-02-01', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Buena respuesta a las primeras intervenciones, evolución ascendente.'),
    -- Camila Acosta — casi finalizada, 3 niveles completados
    (v_etapa7, v_pac7, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-06'),
     (select id from public.algoritmos where codigo = 'ALG-46'), v_mod_rio_32,
     '2026-01-15', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Proceso de integración profundo, casi finalizado.'),
    -- Tomás Vega — etapa completa, los 4 niveles cerrados
    (v_etapa8, v_pac8, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-01'),
     (select id from public.algoritmos where codigo = 'ALG-36'), v_mod_bosque,
     '2025-12-05', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Excelente adherencia, etapa completa.'),
    -- Renata Castro — recién registrada, ningún seguimiento aún
    (v_etapa9, v_pac9, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-31'), v_mod_rio_16,
     '2026-05-22', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Recién comienza, en construcción del vínculo terapéutico.'),
    -- Joaquín Pereyra — mid-treatment, niveles 1-2 cerrados, tendencia flat
    (v_etapa10, v_pac10, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-11'), v_mod_bosque_32,
     '2026-02-25', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Evolución lenta pero consistente, tendencia estable.'),
    -- Felipe Romero — con alerta fuerte, score 1 en último seguimiento
    (v_etapa11, v_pac11, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-11'),
     (select id from public.algoritmos where codigo = 'ALG-12'), v_mod_bosque,
     '2026-03-15', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Requiere revisión de estrategias de regulación.'),
    -- Agustina Méndez — tendencia ascendente, niveles 1-3 con mejora marcada
    (v_etapa12, v_pac12, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-05'),
     (select id from public.algoritmos where codigo = 'ALG-20'), v_mod_rio_32,
     '2026-01-20', v_est_eta_activa,
     'Nota de diagnóstico de ejemplo (ficticia). Muy buena respuesta al trabajo simbólico y al uso de alfabetos.');

  -- Valentina Torres — PRIMER tratamiento, ya CERRADO (fecha_finalizacion + estado
  -- finalizada). La deja con dos etapas → su etapa activa (v_etapa3) queda en
  -- etapaOrdinal = 2. Habilita UAT de la columna Etapa, la distribución por etapa
  -- y (a futuro) el contador de reinicios. (modelo-clinico)
  -- Sin niveles propios: la tabla admin muestra las evals de la etapa ACTIVA, no
  -- de ésta; para etapaOrdinal alcanza con la fila de etapa.
  insert into public.etapas_tratamiento
    (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id,
     fecha_inicio, fecha_finalizacion, estado_id, notas_diagnostico)
  values
    ('e00000f3-0000-0000-0000-000000000000', v_pac3, v_user_ter2,
     (select id from public.causas where codigo = 'CAU-02'),
     (select id from public.algoritmos where codigo = 'ALG-25'), v_mod_rio_32,
     '2025-06-01', '2025-11-30', v_est_eta_final,
     'Primer ciclo de tratamiento, completado y cerrado. Reinició con un segundo tratamiento.');

  -- Marcos Ibarra — paciente DEDICADO a la alerta `reinicio` (Epic 3, task 3.3,
  -- DEC-34), separado de Valentina (que queda como demo de cierre / alerta
  -- `fin`). 1ª etapa CERRADA en el pasado (estado finalizada) sin niveles
  -- propios (igual criterio que e00000f3 de Valentina: etapaOrdinal se resuelve
  -- por row_number() sobre fecha_inicio en derive_alertas_activas, no necesita
  -- niveles). 2ª etapa ACTIVA con fecha_inicio relativa al mes calendario en
  -- curso (v_etapa_reinicio2_inicio, ver declare): etapa_ordinal = 2 y
  -- public.hoy() - fecha_inicio < 28, la condición exacta de `reinicio` en
  -- derive_alertas_activas (65_alertas.sql).
  -- Sobrevive a cualquier `db reset` futuro.
  insert into public.etapas_tratamiento
    (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id,
     fecha_inicio, fecha_finalizacion, estado_id, notas_diagnostico)
  values
    (v_etapa_reinicio1, v_pac_reinicio, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-06'),
     (select id from public.algoritmos where codigo = 'ALG-20'), v_mod_bosque,
     '2025-10-01', '2026-01-30', v_est_eta_final,
     'Primer ciclo de tratamiento, completado y cerrado. Reinició con un segundo tratamiento este mes.');

  insert into public.etapas_tratamiento
    (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id,
     fecha_inicio, estado_id, notas_diagnostico)
  values
    (v_etapa_reinicio2, v_pac_reinicio, v_user_ter1,
     (select id from public.causas where codigo = 'CAU-06'),
     (select id from public.algoritmos where codigo = 'ALG-46'), v_mod_rio_16,
     v_etapa_reinicio2_inicio, v_est_eta_activa,
     'Segundo ciclo de tratamiento, recién reiniciado este mes tras el cierre del primero.');

  -- =====================================================
  -- 21. etapa_bloqueos (2-3 bloqueos por etapa)
  -- =====================================================
  -- bloqueos reales (catálogo generado) referenciados por `codigo`:
  -- BLQ-01 corona, 02 tercer ojo, 03 cuarto ojo, 04 ojo derecho, 06 garganta,
  -- 07 corazón, 08 plexo, 09 sexual.
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select etapa, b.id
  from (values
    (v_etapa1,  'BLQ-06'), (v_etapa1,  'BLQ-02'),
    (v_etapa2,  'BLQ-02'), (v_etapa2,  'BLQ-03'), (v_etapa2,  'BLQ-08'),
    (v_etapa3,  'BLQ-07'), (v_etapa3,  'BLQ-01'),
    (v_etapa4,  'BLQ-04'), (v_etapa4,  'BLQ-02'),
    (v_etapa5,  'BLQ-06'), (v_etapa5,  'BLQ-08'),
    (v_etapa6,  'BLQ-09'), (v_etapa6,  'BLQ-06'),
    (v_etapa7,  'BLQ-02'), (v_etapa7,  'BLQ-01'),
    (v_etapa8,  'BLQ-08'), (v_etapa8,  'BLQ-09'),
    (v_etapa9,  'BLQ-03'), (v_etapa9,  'BLQ-04'),
    (v_etapa10, 'BLQ-07'), (v_etapa10, 'BLQ-06'),
    (v_etapa11, 'BLQ-08'), (v_etapa11, 'BLQ-02'),
    (v_etapa12, 'BLQ-03'), (v_etapa12, 'BLQ-01'), (v_etapa12, 'BLQ-09'),
    -- Marcos Ibarra (reinicio) — solo la 2ª etapa (activa) tiene bloqueos, igual
    -- criterio que la 1ª etapa cerrada de Valentina (e00000f3, sin bloqueos)
    (v_etapa_reinicio2, 'BLQ-01'), (v_etapa_reinicio2, 'BLQ-07')
  ) as t(etapa, codigo)
  join public.bloqueos b on b.codigo = t.codigo;

  -- =====================================================
  -- 22. etapa_alfabetos (Sofía y Sebastián sin alfabetos; el resto con uno o más)
  -- =====================================================
  -- Una fila por número (alfabeto_id, numero), siempre dentro del rango del alfabeto.
  -- Valentina tiene varios números del mismo alfabeto (Iota 15, 21 y 32).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values
    -- Martín y Valentina
    (v_etapa2, v_alfa_telurico, 5),
    (v_etapa2, v_alfa_cosmico, 3),
    (v_etapa3, v_alfa_exorcistico, 15),
    (v_etapa3, v_alfa_exorcistico, 21),
    (v_etapa3, v_alfa_exorcistico, 32),
    (v_etapa3, v_alfa_telurico, 17),
    -- Lucía, Camila, Joaquín, Agustina
    (v_etapa5,  v_alfa_telurico, 8),
    (v_etapa7,  v_alfa_exorcistico, 4),
    (v_etapa7,  v_alfa_cosmico, 6),
    (v_etapa10, v_alfa_telurico, 30),
    (v_etapa10, v_alfa_cosmico, 9),
    (v_etapa12, v_alfa_firmas, 12);

  -- Marcos Ibarra (reinicio) — etapa nueva con números reales de dos alfabetos.
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values
    (v_etapa_reinicio2, v_alfa_exorcistico, 17),
    (v_etapa_reinicio2, v_alfa_cosmico, 11);

  -- =====================================================
  -- 23. niveles (4 por etapa; fechas realistas relativas al 2026-05-26)
  --     fecha_seguimiento_esperada = fecha_inicio + 28 * numero_nivel (un mes de
  --     tratamiento son 28 días, NO un mes calendario — ADR 0011).
  -- =====================================================
  --
  -- SUJETOS CANÓNICOS DE CONTRACT TESTS (Epic 5):
  --   pac1 — Sofía (paciente1@clienteapp.test):
  --     etapa1 inicio 2026-05-05; nivel 1 vigente (fecha_seguimiento_esperada = '2026-06-02',
  --     sin fecha_seguimiento_real ni nivel_evaluacion). Caso: vigente = true.
  --   pac3 — Valentina (paciente3@clienteapp.test):
  --     etapa3 inicio 2025-12-26; los 4 niveles evaluados y con fecha_seguimiento_real.
  --     Caso: vigente = false (tratamiento completado).
  --
  insert into public.niveles (id, etapa_id, numero_nivel, fecha_seguimiento_esperada, fecha_seguimiento_real, observaciones) values
    -- Sofía (etapa1, inicio 2026-05-05): recién arrancó, ningún seguimiento todavía
    (v_nivel_1_1, v_etapa1, 1, '2026-06-02', null, null),
    (v_nivel_1_2, v_etapa1, 2, '2026-06-30', null, null),
    (v_nivel_1_3, v_etapa1, 3, '2026-07-28', null, null),
    (v_nivel_1_4, v_etapa1, 4, '2026-08-25', null, null),
    -- Martín (etapa2, inicio 2026-02-15): niveles 1 y 2 completados, nivel 3 en curso
    (v_nivel_2_1, v_etapa2, 1, '2026-03-15', '2026-03-16',
     'Primer seguimiento completado. Paciente identifica los momentos de mayor activación ansiosa. Experimenta mejora en calidad del sueño.'),
    (v_nivel_2_2, v_etapa2, 2, '2026-04-12', '2026-04-17',
     'Segundo seguimiento. Comienza a tolerar la incertidumbre en el trabajo sin activar pánico. Recupera espacios de descanso.'),
    (v_nivel_2_3, v_etapa2, 3, '2026-05-10', null, null),
    (v_nivel_2_4, v_etapa2, 4, '2026-06-07', null, null),
    -- Valentina (etapa3, inicio 2025-12-26): TODOS los 4 niveles completados
    (v_nivel_3_1, v_etapa3, 1, '2026-01-23', '2026-01-28',
     'Primer seguimiento completado. Paciente logra mayor presencia en las sesiones. Comienza a reconocer patrones vinculares.'),
    (v_nivel_3_2, v_etapa3, 2, '2026-02-20', '2026-02-27',
     'Segundo seguimiento. Identifica patrones disociativos en vínculos significativos. Mejor regulación emocional.'),
    (v_nivel_3_3, v_etapa3, 3, '2026-03-20', '2026-03-29',
     'Tercer seguimiento. Integra emociones sin desconectarse. Construye nuevos vínculos basados en confianza.'),
    (v_nivel_3_4, v_etapa3, 4, '2026-04-17', '2026-04-28',
     'Cuarto seguimiento. Etapa completa. Paciente reporta vínculos más plenos y sostenidos en el tiempo.'),
    -- Sebastián (etapa4, inicio 2026-01-26): 3 niveles completados, nivel 4 en curso
    (v_nivel_4_1, v_etapa4, 1, '2026-02-23', '2026-02-27',
     'Primer seguimiento completado. Paciente reporta mayor conciencia sobre sus patrones de autoexigencia. Incorpora pausas activas en su rutina diaria.'),
    (v_nivel_4_2, v_etapa4, 2, '2026-03-23', '2026-03-27',
     'Segundo seguimiento. Permite el descanso sin culpa. Reduce autocrítica frente a errores.'),
    (v_nivel_4_3, v_etapa4, 3, '2026-04-20', '2026-04-27',
     'Tercer seguimiento. Desarrolla compasión hacia sus limitaciones. Ritmo más sostenible.'),
    (v_nivel_4_4, v_etapa4, 4, '2026-05-18', null, null),
    -- Lucía (etapa5, inicio dinámico v_etapa5_inicio): nivel 1 cerrado con
    -- score bajo (alerta score_bajo); nivel 2 sin evaluación → dispara
    -- eval_vencida (el más antiguo vencido, ya que mes_actual queda en 3).
    (v_nivel_5_1, v_etapa5, 1, v_etapa5_inicio + 28, v_etapa5_inicio + 30,
     'Primer seguimiento completado. Paciente reporta crisis frecuentes y dificultad para regular la activación. Score bajo refleja momento agudo.'),
    (v_nivel_5_2, v_etapa5, 2, v_etapa5_inicio + 56, null, null),
    (v_nivel_5_3, v_etapa5, 3, v_etapa5_inicio + 84, null, null),
    (v_nivel_5_4, v_etapa5, 4, v_etapa5_inicio + 112, null, null),
    -- Pedro (etapa6, inicio 2026-02-01): niveles 1-3 cerrados con mejora progresiva
    (v_nivel_6_1, v_etapa6, 1, '2026-03-01', '2026-03-02',
     'Primer seguimiento. Inicia trabajo de elaboración del duelo. Mucho dolor expresado por primera vez.'),
    (v_nivel_6_2, v_etapa6, 2, '2026-03-29', '2026-04-03',
     'Segundo seguimiento. Aparecen momentos de calma entre los picos. Mejor capacidad de pausa.'),
    (v_nivel_6_3, v_etapa6, 3, '2026-04-26', '2026-05-02',
     'Tercer seguimiento. Integración emocional consistente. Vuelve a actividades sociales con energía renovada.'),
    (v_nivel_6_4, v_etapa6, 4, '2026-05-24', null, null),
    -- Camila (etapa7, inicio 2026-01-15): niveles 1-3 cerrados, 4 en curso (cerca de hoy)
    (v_nivel_7_1, v_etapa7, 1, '2026-02-12', '2026-02-16',
     'Primer seguimiento. Apertura inicial hacia el trabajo simbólico, primera conexión con el alfabeto Iota.'),
    (v_nivel_7_2, v_etapa7, 2, '2026-03-12', '2026-03-16',
     'Segundo seguimiento. Reconoce patrones disociativos en vínculos cercanos. Inicia trabajo somático.'),
    (v_nivel_7_3, v_etapa7, 3, '2026-04-09', '2026-04-17',
     'Tercer seguimiento. Integración progresiva. Capacidad de sostener emociones complejas sin desconectar.'),
    (v_nivel_7_4, v_etapa7, 4, '2026-05-07', null, null),
    -- Tomás (etapa8, inicio 2025-12-05): los 4 niveles cerrados → nivelFinalizado
    (v_nivel_8_1, v_etapa8, 1, '2026-01-02', '2026-01-07',
     'Primer seguimiento. Identifica voz autocrítica y su impacto en bienestar diario.'),
    (v_nivel_8_2, v_etapa8, 2, '2026-01-30', '2026-02-06',
     'Segundo seguimiento. Permite el descanso. Reduce demandas internas sin culpa.'),
    (v_nivel_8_3, v_etapa8, 3, '2026-02-27', '2026-03-07',
     'Tercer seguimiento. Desarrolla compasión hacia limitaciones. Ritmo sostenible en lo profesional.'),
    (v_nivel_8_4, v_etapa8, 4, '2026-03-27', '2026-04-08',
     'Cuarto seguimiento. Etapa completa. Vínculo consigo mismo desde aceptación genuina.'),
    -- Renata (etapa9, inicio 2026-05-22): recién registrada, ningún seguimiento aún
    (v_nivel_9_1, v_etapa9, 1, '2026-06-19', null, null),
    (v_nivel_9_2, v_etapa9, 2, '2026-07-17', null, null),
    (v_nivel_9_3, v_etapa9, 3, '2026-08-14', null, null),
    (v_nivel_9_4, v_etapa9, 4, '2026-09-11', null, null),
    -- Joaquín (etapa10, inicio 2026-02-25): niveles 1-2 cerrados, 3 en curso
    (v_nivel_10_1, v_etapa10, 1, '2026-03-25', '2026-03-27',
     'Primer seguimiento. Identifica disparadores principales. Mejora en sueño y alimentación.'),
    (v_nivel_10_2, v_etapa10, 2, '2026-04-22', '2026-04-28',
     'Segundo seguimiento. Tolera mejor la incertidumbre sin activar el patrón de aferramiento.'),
    (v_nivel_10_3, v_etapa10, 3, '2026-05-20', null, null),
    (v_nivel_10_4, v_etapa10, 4, '2026-06-17', null, null),
    -- Felipe (etapa11, inicio 2026-03-15): nivel 1 OK, nivel 2 con score 1 (alerta fuerte)
    (v_nivel_11_1, v_etapa11, 1, '2026-04-12', '2026-04-17',
     'Primer seguimiento. Identifica patrones ansiógenos en contexto laboral. Trabajo psicoeducativo intensivo.'),
    (v_nivel_11_2, v_etapa11, 2, '2026-05-10', '2026-05-17',
     'Segundo seguimiento. Episodio de descompensación durante el período. Score bajo refleja crisis aguda en curso.'),
    (v_nivel_11_3, v_etapa11, 3, '2026-06-07', null, null),
    (v_nivel_11_4, v_etapa11, 4, '2026-07-05', null, null),
    -- Agustina (etapa12, inicio 2026-01-20): niveles 1-3 cerrados con tendencia ascendente
    (v_nivel_12_1, v_etapa12, 1, '2026-02-17', '2026-02-22',
     'Primer seguimiento. Apertura inicial al trabajo emocional, todavía con mucha disociación protectora.'),
    (v_nivel_12_2, v_etapa12, 2, '2026-03-17', '2026-03-22',
     'Segundo seguimiento. Incorpora alfabeto Iota en el trabajo. Reconoce emociones por primera vez en vivo.'),
    (v_nivel_12_3, v_etapa12, 3, '2026-04-14', '2026-04-23',
     'Tercer seguimiento. Sostiene la presencia emocional. Mejora franca en vínculos cercanos.'),
    (v_nivel_12_4, v_etapa12, 4, '2026-05-12', null, null),
    -- Marcos Ibarra (etapa_reinicio2, inicio v_etapa_reinicio2_inicio, mes en
    -- curso): 2ª etapa recién arrancada, ningún seguimiento todavía
    (v_nivel_reinicio2_1, v_etapa_reinicio2, 1, v_etapa_reinicio2_inicio + 28, null, null),
    (v_nivel_reinicio2_2, v_etapa_reinicio2, 2, v_etapa_reinicio2_inicio + 56, null, null),
    (v_nivel_reinicio2_3, v_etapa_reinicio2, 3, v_etapa_reinicio2_inicio + 84, null, null),
    (v_nivel_reinicio2_4, v_etapa_reinicio2, 4, v_etapa_reinicio2_inicio + 112, null, null);

  -- =====================================================
  -- 24. entregas_plan (copia de plantilla por etapa)
  -- =====================================================
  -- etapa 1 (Sofía) — inicio 2026-05-05; PLAN COMPLETO de 16 semanas. Antes se
  -- sembraban solo 3 semanas (días 0/1/3/7/14), y eso dejaba a mobile sin semana
  -- "actual" con contenido. Eran 18 hasta modeloClinicoV2, cuando las semanas
  -- pasaron a ser cantidad_niveles*4 = 16 (ver semanas_de_etapa): con 18 el plan
  -- tampoco daba por completo, porque la regla pide exactamente las requeridas. Ahora se genera el plan entero espejando lo que
  -- set_entregas_plan autoriza en prod: los CINCO slots de cada semana
  -- (1=video/meditación, 2=audio/mantra, 3=egregor, 4=cma, 5=ic — SLOT_DEFINITIONS
  -- y etapa_plan_completo desde el PR #52), dia_offset = (semana-1)*7 uniforme.
  -- Antes se sembraban solo 2 y ninguna semana daba por completa, así que el plan
  -- nunca podía dispararse: ni bienvenida, ni arranque del tratamiento, ni OTP. La frase de la semana ya
  -- no se persiste acá (frasesAutomaticas): se deriva de la causa/algoritmo de la
  -- etapa. Las fechas entregada/consumida se derivan de public.hoy() para que el
  -- estado del plan (anterior/actual/futura) quede coherente con el reloj de hoy.
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden, fecha_entregada, fecha_consumida)
  select
    v_etapa1,
    (w - 1) * 7,
    case comp.kind
      when 'video'   then case when w % 2 = 1 then v_cont_1 else v_cont_5 end
      when 'audio'   then case when w % 2 = 1 then v_cont_2 else v_cont_4 end
      when 'egregor' then v_cont_egr
      when 'cma'     then v_cont_cma
      when 'ic'      then v_cont_ic
    end,
    comp.orden,
    -- entregada cuando su semana ya arrancó; null si la semana es futura
    case when ('2026-05-05'::date + (w - 1) * 7) <= public.hoy()
      then (('2026-05-05'::date + (w - 1) * 7) + time '09:00') at time zone 'UTC'
    end,
    -- consumida solo para semanas ya cerradas (>7 días atrás)
    case when ('2026-05-05'::date + (w - 1) * 7) + 7 <= public.hoy()
      then (('2026-05-05'::date + (w - 1) * 7) + time '20:00') at time zone 'UTC'
    end
  from generate_series(1, 16) as w
  cross join (values ('video', 1), ('audio', 2), ('egregor', 3), ('cma', 4), ('ic', 5)) as comp(kind, orden);

  -- etapa 2 (Martín) — inicio 2026-02-15; entregas completas
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden, fecha_entregada, fecha_consumida) values
    (v_etapa2, 0,  v_cont_1, 1, '2026-02-15 09:00:00+00', '2026-02-15 20:00:00+00'),
    (v_etapa2, 5,  v_cont_4, 1, '2026-02-20 09:00:00+00', '2026-02-21 10:00:00+00'),
    (v_etapa2, 10, v_cont_2, 1, '2026-02-25 09:00:00+00', null),
    (v_etapa2, 14, v_cont_5, 1, '2026-03-01 09:00:00+00', null);

  -- etapa 3 (Valentina) — inicio 2025-12-26; etapa completada, todas consumidas
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden, fecha_entregada, fecha_consumida) values
    (v_etapa3, 0,  v_cont_1, 1, '2025-12-26 09:00:00+00', '2025-12-26 22:00:00+00'),
    (v_etapa3, 3,  v_cont_2, 1, '2025-12-29 09:00:00+00', '2025-12-30 09:00:00+00'),
    (v_etapa3, 7,  v_cont_4, 1, '2026-01-02 09:00:00+00', '2026-01-03 09:00:00+00'),
    (v_etapa3, 14, v_cont_5, 1, '2026-01-09 09:00:00+00', '2026-01-10 09:00:00+00');

  -- etapa 4 (Sebastián) — inicio 2026-01-26; cerca del final, mayoría consumidas
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden, fecha_entregada, fecha_consumida) values
    (v_etapa4, 0,  v_cont_1, 1, '2026-01-26 09:00:00+00', '2026-01-26 21:00:00+00'),
    (v_etapa4, 5,  v_cont_4, 1, '2026-01-31 09:00:00+00', '2026-02-01 09:00:00+00'),
    (v_etapa4, 10, v_cont_2, 1, '2026-02-05 09:00:00+00', '2026-02-06 09:00:00+00'),
    (v_etapa4, 14, v_cont_5, 1, '2026-02-09 09:00:00+00', null);

  -- =====================================================
  -- 25. nivel_evaluacion (scores de los niveles completados)
  -- =====================================================
  insert into public.nivel_evaluacion (nivel_id, score, fecha_respuesta) values
    -- Sofía: sin scores aún (etapa recién arrancada)
    -- Martín: 2 scores (niveles 1 y 2)
    (v_nivel_2_1, 4, '2026-03-16 10:00:00+00'),
    (v_nivel_2_2, 4, '2026-04-17 11:00:00+00'),
    -- Valentina: 4 scores (etapa completa, evolución ascendente)
    (v_nivel_3_1, 3, '2026-01-28 09:30:00+00'),
    (v_nivel_3_2, 3, '2026-02-27 10:00:00+00'),
    (v_nivel_3_3, 4, '2026-03-29 10:30:00+00'),
    (v_nivel_3_4, 5, '2026-04-28 11:00:00+00'),
    -- Sebastián: 3 scores (niveles 1, 2 y 3)
    (v_nivel_4_1, 3, '2026-02-27 10:00:00+00'),
    (v_nivel_4_2, 3, '2026-03-27 10:30:00+00'),
    (v_nivel_4_3, 4, '2026-04-27 11:00:00+00'),
    -- Lucía: 1 score bajo (alerta) — fecha relativa a v_etapa5_inicio (task 0.7)
    (v_nivel_5_1, 2, (v_etapa5_inicio + 30 + interval '10 hours')),
    -- Pedro: 3 scores con tendencia ascendente
    (v_nivel_6_1, 2, '2026-03-02 10:00:00+00'),
    (v_nivel_6_2, 3, '2026-04-03 10:30:00+00'),
    (v_nivel_6_3, 4, '2026-05-02 11:00:00+00'),
    -- Camila: 3 scores estables, casi finalizada
    (v_nivel_7_1, 3, '2026-02-16 09:30:00+00'),
    (v_nivel_7_2, 4, '2026-03-16 10:00:00+00'),
    (v_nivel_7_3, 4, '2026-04-17 10:30:00+00'),
    -- Tomás: 4 scores (etapa completa, evolución sostenida)
    (v_nivel_8_1, 3, '2026-01-07 09:00:00+00'),
    (v_nivel_8_2, 4, '2026-02-06 09:30:00+00'),
    (v_nivel_8_3, 4, '2026-03-07 10:00:00+00'),
    (v_nivel_8_4, 5, '2026-04-08 10:30:00+00'),
    -- Renata: sin scores (recién arrancada)
    -- Joaquín: 2 scores estables
    (v_nivel_10_1, 3, '2026-03-27 10:00:00+00'),
    (v_nivel_10_2, 3, '2026-04-28 10:30:00+00'),
    -- Felipe: 2 scores; el segundo es 1 (alerta fuerte)
    (v_nivel_11_1, 3, '2026-04-17 10:00:00+00'),
    (v_nivel_11_2, 1, '2026-05-17 11:00:00+00'),
    -- Agustina: 3 scores con tendencia ascendente fuerte
    (v_nivel_12_1, 2, '2026-02-22 09:30:00+00'),
    (v_nivel_12_2, 3, '2026-03-22 10:00:00+00'),
    (v_nivel_12_3, 4, '2026-04-23 10:30:00+00');

end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Paciente de prueba e2e OTP/WhatsApp (pacienteOtpIntegracion). Persistido para
-- re-testear el flujo tras db reset. Plan 15/16 semanas → falta la última (el
-- terapeuta2 la completa en /asignar-contenido y al Guardar dispara el OTP).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_pac        uuid := 'd0000099-0000-0000-0000-000000000099';
  v_etapa      uuid := 'e1000099-0000-0000-0000-000000000099';
  v_ter        uuid := 'c0000004-0000-0000-0000-000000000000'; -- MT-0003 (terapeuta2), = auth.users.id
  v_causa      uuid := '7ed2d9ac-e38a-4db9-8ce0-e933ccb4b30f';
  v_algo       uuid := 'd4638649-fa8c-4415-9c4d-c15ad3b45e5b';
  v_modalidad  uuid := 'b2000002-0000-0000-0000-000000000000'; -- Bosque 16 (16 semanas)
  v_est_etapa  uuid := 'a4000001-0000-0000-0000-000000000000'; -- etapa activa
  v_est_pac    uuid := 'a3000001-0000-0000-0000-000000000000'; -- paciente activo
  v_video      uuid := 'b1000001-0000-0000-0000-000000000000';
  v_audio      uuid := 'b1000002-0000-0000-0000-000000000000';
  v_egregor    uuid := 'b1000010-0000-0000-0000-000000000000';
  v_cma        uuid := 'b1000011-0000-0000-0000-000000000000';
  v_ic         uuid := 'b1000012-0000-0000-0000-000000000000';
  v_email      text := 'tomas.ejemplo@paciente.test';
  v_tel        text := '+5491150000001';
  v_dob        date := '1990-01-01';
begin
  -- Limpieza idempotente (hijos → padres).
  delete from public.otps_activacion where paciente_id = v_pac;
  delete from public.entregas_plan   where etapa_id   = v_etapa;
  delete from public.etapas_tratamiento where id = v_etapa;
  delete from public.asignaciones_paciente where paciente_id = v_pac;
  delete from auth.users where email = v_email;
  delete from public.pacientes where id = v_pac or email = v_email;

  -- Paciente (sin cuenta: user_id null).
  insert into public.pacientes (id, user_id, nombre, telefono, email, fecha_nacimiento, estado_id, activo, fecha_alta)
  values (v_pac, null, 'Tomás Ejemplo', v_tel, v_email, v_dob, v_est_pac, true, public.hoy());

  -- Asignación activa al terapeuta2.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, fecha_hasta, asignado_por, motivo)
  values (v_pac, v_ter, now(), null, v_ter, 'Prueba e2e OTP WhatsApp');

  -- Etapa de tratamiento activa (modalidad Bosque 16).
  insert into public.etapas_tratamiento (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id)
  values (v_etapa, v_pac, v_ter, v_causa, v_algo, v_modalidad, public.hoy(), v_est_etapa);

  -- Plan: semanas 1..15 COMPLETAS con los cinco slots que exige
  -- etapa_plan_completo (1=video, 2=audio, 3=egregor, 4=cma, 5=ic). La semana 16
  -- (offset 105) queda entera sin asignar, que es el gancho de esta fixture:
  -- cargarla desde /asignar-contenido completa el plan y dispara la bienvenida.
  --
  -- Hasta el PR #52 esto sembraba 2 slots por semana y la regla ya pedía 5, así
  -- que ninguna semana daba por completa: completar la 16 no disparaba nada y el
  -- fallo era silencioso (la UI guardaba igual).
  insert into public.entregas_plan (etapa_id, dia_offset, orden, contenido_id)
  select v_etapa, wk * 7, slot.orden, slot.contenido
  from generate_series(0, 14) as wk
  cross join (values
    (1, v_video), (2, v_audio), (3, v_egregor), (4, v_cma), (5, v_ic)
  ) as slot(orden, contenido);

  raise notice 'Paciente JMG sembrado: % (etapa %, 15/16 semanas con los 5 slots, falta la 16 entera)', v_pac, v_etapa;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pacientes "sin iniciar" (inicioTratamiento, Epic 6, task 6.1). Fixture
-- dedicada para que el estado nuevo (etapa `pendiente`, fecha_inicio NULL) se
-- vea sin fabricarlo a mano en cada entorno — bloque independiente, appendeado
-- al final (§10, regla de convivencia): no toca una sola línea de los bloques
-- de arriba.
--   A — "sin nada": etapa recién creada, CERO entregas_plan. El caso base:
--     ninguna alerta de progreso, sí `contenido_pendiente`.
--   B — "a medio cargar": etapa en modalidad Bosque 32 (32 = cantidad_sesiones,
--     metadata clínica de discos — NO semanas; cantidad_niveles=4 en las 4
--     modalidades ⇒ semanasDeTratamiento = 4*4 = 16 SIEMPRE, ver
--     semanasDeTratamiento.ts) con 6 de 16 semanas de plan YA cargadas pero
--     sin arrancar. El caso que importa (DEC-6c): el widget viejo (por "cero
--     entregas") NO la mostraría; el nuevo (por fecha_inicio is null) SÍ.
-- Ambas asignadas a terapeuta1 (Laura Martínez) para verlas juntas en un solo
-- login durante UAT manual.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_est_pac_activo    uuid := 'a3000001-0000-0000-0000-000000000000';
  v_est_eta_pendiente uuid := 'a4000004-0000-0000-0000-000000000000'; -- catálogo sembrado en 04_estados_etapa.sql (DEC-E0-6)
  v_ter1              uuid := 'c0000003-0000-0000-0000-000000000000'; -- Laura Martínez (MT-0002)
  v_admin_ter         uuid := 'c0000002-0000-0000-0000-000000000000'; -- Ana García

  v_cont_1  uuid := 'b1000001-0000-0000-0000-000000000000';
  v_cont_2  uuid := 'b1000002-0000-0000-0000-000000000000';
  v_cont_4  uuid := 'b1000004-0000-0000-0000-000000000000';
  v_cont_5  uuid := 'b1000005-0000-0000-0000-000000000000';
  v_cont_egr uuid := 'b1000010-0000-0000-0000-000000000000';
  v_cont_cma uuid := 'b1000011-0000-0000-0000-000000000000';
  v_cont_ic  uuid := 'b1000012-0000-0000-0000-000000000000';
  -- v_frase_1 / v_frase_2: retirados en feat/frases-automaticas junto con la tabla
  -- frases_motivacionales y la columna entregas_plan.frase_id. Las frases ya no se
  -- asignan: se derivan de (causa, algoritmo, semana). No reintroducirlos.

  v_mod_rio_16    uuid := 'b2000004-0000-0000-0000-000000000000'; -- 16 Río
  v_mod_bosque_32 uuid := 'b2000005-0000-0000-0000-000000000000'; -- 32 Bosque

  v_alfa_telurico    uuid := 'a9000102-0000-0000-0000-000000000000';
  v_alfa_exorcistico uuid := 'a9000103-0000-0000-0000-000000000000';
  v_alfa_cosmico     uuid := 'a9000104-0000-0000-0000-000000000000';

  -- Paciente A — "sin nada"
  v_pac_a    uuid := 'd0000101-0000-0000-0000-000000000000';
  v_etapa_a  uuid := 'e0000101-0000-0000-0000-000000000000';
  v_nivel_a1 uuid := 'f0000101-0000-0000-0000-000000000000';
  v_nivel_a2 uuid := 'f0000102-0000-0000-0000-000000000000';
  v_nivel_a3 uuid := 'f0000103-0000-0000-0000-000000000000';
  v_nivel_a4 uuid := 'f0000104-0000-0000-0000-000000000000';

  -- Paciente B — "a medio cargar"
  v_pac_b    uuid := 'd0000102-0000-0000-0000-000000000000';
  v_etapa_b  uuid := 'e0000102-0000-0000-0000-000000000000';
  v_nivel_b1 uuid := 'f0000105-0000-0000-0000-000000000000';
  v_nivel_b2 uuid := 'f0000106-0000-0000-0000-000000000000';
  v_nivel_b3 uuid := 'f0000107-0000-0000-0000-000000000000';
  v_nivel_b4 uuid := 'f0000108-0000-0000-0000-000000000000';
begin
  -- pacientes
  insert into public.pacientes (id, user_id, nombre, telefono, email, fecha_nacimiento, contacto_alternativo, relacion_contacto, fecha_alta, estado_id) values
    (v_pac_a, null, 'Bianca Correa', '+54 11 7001-0001', 'bianca.correa@paciente.test', '1995-03-22', 'Marcelo Correa', 'padre',  '2026-07-06', v_est_pac_activo),
    (v_pac_b, null, 'Ignacio Bravo', '+54 11 7001-0002', 'ignacio.bravo@paciente.test', '1989-10-11', 'Daniela Bravo',  'esposa', '2026-06-22', v_est_pac_activo);

  -- asignaciones (activas: fecha_hasta is null)
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por, motivo) values
    (v_pac_a, v_ter1, '2026-07-06', v_admin_ter, 'Asignación inicial — paciente recién dado de alta, plan sin cargar'),
    (v_pac_b, v_ter1, '2026-06-22', v_admin_ter, 'Asignación inicial — plan a medio cargar, tratamiento sin arrancar');

  -- etapas (pendiente: fecha_inicio NULL, estado_id = catálogo pendiente)
  insert into public.etapas_tratamiento (id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id, notas_diagnostico) values
    (v_etapa_a, v_pac_a, v_ter1,
     (select id from public.causas where codigo = 'CAU-04'),
     (select id from public.algoritmos where codigo = 'ALG-08'), v_mod_rio_16,
     null, v_est_eta_pendiente,
     'Diagnóstico recién cargado. Etapa creada, esperando la carga del contenido para arrancar (DEC-3, inicioTratamiento).'),
    (v_etapa_b, v_pac_b, v_ter1,
     (select id from public.causas where codigo = 'CAU-09'),
     (select id from public.algoritmos where codigo = 'ALG-19'), v_mod_bosque_32,
     null, v_est_eta_pendiente,
     'Diagnóstico cargado, plan de contenido a medio armar (6 de 16 semanas — Bosque 32 son 32 discos/sesiones, no semanas). Etapa todavía sin arrancar.');

  -- niveles (sin agendar: fecha_seguimiento_esperada NULL, per DEC-E1-4)
  insert into public.niveles (id, etapa_id, numero_nivel, fecha_seguimiento_esperada, fecha_seguimiento_real, observaciones) values
    (v_nivel_a1, v_etapa_a, 1, null, null, null),
    (v_nivel_a2, v_etapa_a, 2, null, null, null),
    (v_nivel_a3, v_etapa_a, 3, null, null, null),
    (v_nivel_a4, v_etapa_a, 4, null, null, null),
    (v_nivel_b1, v_etapa_b, 1, null, null, null),
    (v_nivel_b2, v_etapa_b, 2, null, null, null),
    (v_nivel_b3, v_etapa_b, 3, null, null, null),
    (v_nivel_b4, v_etapa_b, 4, null, null, null);

  -- etapa_bloqueos
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select etapa, b.id
  from (values
    (v_etapa_a, 'BLQ-05'), (v_etapa_a, 'BLQ-10'),
    (v_etapa_b, 'BLQ-11'), (v_etapa_b, 'BLQ-12')
  ) as t(etapa, codigo)
  join public.bloqueos b on b.codigo = t.codigo;

  -- etapa_alfabetos
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero) values
    (v_etapa_a, v_alfa_telurico, 10),
    (v_etapa_b, v_alfa_exorcistico, 20),
    (v_etapa_b, v_alfa_cosmico, 7);

  -- entregas_plan — A: cero (caso base, sin insert). B: 6 de 16 semanas ya
  -- cargadas (16 = cantidad_niveles(4)*4, fijo — los "32" de Bosque 32 son
  -- discos/sesiones clínicas, no semanas de contenido), sin entregar/consumir
  -- todavía (la etapa no arrancó, fecha_entregada/fecha_consumida quedan null).
  --
  -- ⚠️ 5 slots por semana: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic. Es la misma
  -- regla que aplica etapa_plan_completo() para decidir si el tratamiento arranca,
  -- y la que valida set_entregas_plan (tipo por orden). Eran 2 hasta el PR #52 y
  -- quedaron sin actualizar: con 2, ninguna semana daba por completa.
  -- La frase NO va acá: dejó de ser una entrega asignable en feat/frases-automaticas,
  -- se deriva de (causa, algoritmo, semana) y frase_id ya no existe.
  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden)
  select
    v_etapa_b,
    (w - 1) * 7,
    case comp.kind
      when 'video'   then case when w % 2 = 1 then v_cont_1 else v_cont_5 end
      when 'audio'   then case when w % 2 = 1 then v_cont_2 else v_cont_4 end
      when 'egregor' then v_cont_egr
      when 'cma'     then v_cont_cma
      when 'ic'      then v_cont_ic
    end,
    comp.orden
  from generate_series(1, 6) as w
  cross join (values ('video', 1), ('audio', 2), ('egregor', 3), ('cma', 4), ('ic', 5)) as comp(kind, orden);

  raise notice 'Paciente A sembrado (sin iniciar, sin nada): % (etapa %, 0 entregas)', v_pac_a, v_etapa_a;
  raise notice 'Paciente B sembrado (sin iniciar, a medio cargar): % (etapa %, 6/16 semanas)', v_pac_b, v_etapa_b;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures de mediciones de estructura (sdd/medir-chakras, PR1 task 1.16,
-- design §6). Bloque independiente, appendeado al final: no toca una sola
-- línea de los bloques de arriba.
--
-- Sembradas VÍA LAS RPCs REALES (registrar_medicion/cerrar_etapa), no con
-- inserts crudos en mediciones_estructura/medicion_valores: esto ejerce la
-- capa de negocio completa (validación, momento, cierre_automatico) como
-- humo embebido en el seed, y evita duplicar a mano la lógica de inserción.
-- Se simula el caller con set_config('request.jwt.claim.sub', ..., true) —
-- mismo mecanismo que supabase/tests/baja_voluntaria.sql — porque seed.sql
-- corre como postgres/owner, sin JWT.
--
-- ⚠️ GOTCHA (igual que documenta supabase/tests/mediciones_estructura.sql):
-- now() es constante para toda la transacción implícita de ESTE bloque DO,
-- así que cada registrar_medicion de acá abajo backdatea registrada_en con
-- un UPDATE inmediato después del insert — si no, las 2-3 mediciones de un
-- mismo paciente quedarían con el mismo timestamp y "la última medición"
-- (order by registrada_en desc, id desc) empataría en un uuid random en vez
-- de reflejar el orden real de carga.
--
-- Cuatro estados distintos (design §6), porque ejercitan 4 pantallas
-- distintas de la pestaña Estructura / Historia:
--   1. Sofía (v_pac1/v_etapa1, YA sembrada arriba) — apertura + 2 seguimiento:
--      el estado "con mediciones" (hero + sparkline + deltas por centro).
--   2. Paciente con UNA sola medición: sin deltas en ningún lado.
--   3. Paciente con una etapa abierta en su última semana de contenido:
--      dispara la alerta medicion_cierre_pendiente y el banner.
--   4. Paciente con DOS etapas, la primera cerrada por un admin sin
--      asignación (DEC-31/33) — genera un cierre_automatico real.
do $$
declare
  v_ter1          uuid := 'c0000003-0000-0000-0000-000000000000'; -- Laura Martínez (MT-0002)
  v_admin         uuid := 'c0000001-0000-0000-0000-000000000000'; -- Carlos Administrador, sin pacientes propios
  v_admin_ter     uuid := 'c0000002-0000-0000-0000-000000000000'; -- Ana García (asignado_por, no relevante acá)
  v_est_pac_activo uuid := 'a3000001-0000-0000-0000-000000000000';
  v_est_eta_activa uuid := 'a4000001-0000-0000-0000-000000000000';
  v_modalidad      uuid := 'b2000002-0000-0000-0000-000000000000'; -- Bosque 16 (cantidad_niveles=4 → 16 semanas)
  v_cantidad_niveles int;

  -- etapa1 de Sofía — ya sembrada arriba, reusada acá tal cual.
  v_etapa1 uuid := 'e0000001-0000-0000-0000-000000000000';

  -- Fixture 2 — una sola medición.
  v_pac_mc2   uuid := 'd0000201-0000-0000-0000-000000000000';
  v_etapa_mc2 uuid := 'e0000201-0000-0000-0000-000000000000';

  -- Fixture 3 — última semana de contenido, sin cerrar (dispara la alerta).
  v_pac_mc3   uuid := 'd0000202-0000-0000-0000-000000000000';
  v_etapa_mc3 uuid := 'e0000202-0000-0000-0000-000000000000';
  v_fecha_mc3 date;

  -- Fixture 4 — dos etapas, la primera cerrada con cierre_automatico.
  v_pac_mc4    uuid := 'd0000203-0000-0000-0000-000000000000';
  v_etapa4a_id uuid := 'e0000203-0000-0000-0000-000000000000';
  v_etapa4b_id uuid := 'e0000204-0000-0000-0000-000000000000';

  v_centro_ids uuid[];
  v_valores    jsonb;
  v_med1       uuid;
  v_med2       uuid;
begin
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;
  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad;

  -- ---------------------------------------------------------------------
  -- Fixture 1 — Sofía/pac1/etapa1: apertura + 2 seguimiento.
  -- ---------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_ter1::text, true);

  v_valores := jsonb_build_object(
    'estructura_general', 40,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 40)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa1, v_valores, null);
  update public.mediciones_estructura set registrada_en = '2026-05-05 10:00:00+00' where id = v_med1;

  v_valores := jsonb_build_object(
    'estructura_general', 48,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 48)) from unnest(v_centro_ids) as c)
  );
  v_med2 := public.registrar_medicion(v_etapa1, v_valores, v_med1);
  update public.mediciones_estructura set registrada_en = '2026-06-05 10:00:00+00' where id = v_med2;

  v_valores := jsonb_build_object(
    'estructura_general', 55,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 55)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa1, v_valores, v_med2);
  update public.mediciones_estructura set registrada_en = '2026-07-05 10:00:00+00' where id = v_med1;

  -- ---------------------------------------------------------------------
  -- Fixture 2 — paciente con UNA sola medición (sin deltas).
  -- ---------------------------------------------------------------------
  insert into public.pacientes (id, nombre, telefono, fecha_nacimiento, email, estado_id, activo, fecha_alta)
  values (
    v_pac_mc2, 'Valentina Suárez', '+541157000001', '1992-08-14', 'valentina.suarez@paciente.test',
    v_est_pac_activo, true, public.hoy() - 20
  );

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por, motivo)
  values (v_pac_mc2, v_ter1, public.hoy() - 20, v_admin_ter, 'Asignación inicial');

  insert into public.etapas_tratamiento (
    id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_etapa_mc2, v_pac_mc2, v_ter1,
    (select id from public.causas where codigo = 'CAU-01'),
    (select id from public.algoritmos where codigo = 'ALG-30'),
    v_modalidad, public.hoy() - 14, v_est_eta_activa
  );

  v_valores := jsonb_build_object(
    'estructura_general', 45,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 45)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa_mc2, v_valores, null);
  update public.mediciones_estructura set registrada_en = (public.hoy() - 14)::timestamptz where id = v_med1;

  -- ---------------------------------------------------------------------
  -- Fixture 3 — etapa abierta en su última semana de contenido: dispara
  -- medicion_cierre_pendiente. fecha_inicio se calcula para caer un día
  -- DESPUÉS de que arranque la última semana
  -- (fecha_inicio + (semanas_de_etapa - 1) * 7), sin importar cuándo corra
  -- este seed.
  -- ---------------------------------------------------------------------
  v_fecha_mc3 := public.hoy() - ((v_cantidad_niveles * 4 - 1) * 7 + 1);

  insert into public.pacientes (id, nombre, telefono, fecha_nacimiento, email, estado_id, activo, fecha_alta)
  values (
    v_pac_mc3, 'Ramiro Escobar', '+541157000002', '1987-02-28', 'ramiro.escobar@paciente.test',
    v_est_pac_activo, true, v_fecha_mc3
  );

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por, motivo)
  values (v_pac_mc3, v_ter1, v_fecha_mc3, v_admin_ter, 'Asignación inicial');

  insert into public.etapas_tratamiento (
    id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_etapa_mc3, v_pac_mc3, v_ter1,
    (select id from public.causas where codigo = 'CAU-05'),
    (select id from public.algoritmos where codigo = 'ALG-36'),
    v_modalidad, v_fecha_mc3, v_est_eta_activa
  );

  v_valores := jsonb_build_object(
    'estructura_general', 42,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 42)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa_mc3, v_valores, null);
  update public.mediciones_estructura set registrada_en = v_fecha_mc3::timestamptz where id = v_med1;

  -- ---------------------------------------------------------------------
  -- Fixture 4 — dos etapas; la primera se cierra por un ADMIN SIN
  -- ASIGNACIÓN (DEC-31/33: sin el guard de medicion_cierre_requerida),
  -- generando un cierre_automatico real a partir de su última medición.
  -- ---------------------------------------------------------------------
  insert into public.pacientes (id, nombre, telefono, fecha_nacimiento, email, estado_id, activo, fecha_alta)
  values (
    v_pac_mc4, 'Delfina Acosta', '+541157000003', '1994-11-30', 'delfina.acosta@paciente.test',
    v_est_pac_activo, true, public.hoy() - 220
  );

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por, motivo)
  values (v_pac_mc4, v_ter1, public.hoy() - 220, v_admin_ter, 'Asignación inicial');

  insert into public.etapas_tratamiento (
    id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_etapa4a_id, v_pac_mc4, v_ter1,
    (select id from public.causas where codigo = 'CAU-06'),
    (select id from public.algoritmos where codigo = 'ALG-46'),
    v_modalidad, public.hoy() - 220, v_est_eta_activa
  );

  perform set_config('request.jwt.claim.sub', v_ter1::text, true);

  v_valores := jsonb_build_object(
    'estructura_general', 35,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 35)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa4a_id, v_valores, null);
  update public.mediciones_estructura set registrada_en = (public.hoy() - 220)::timestamptz where id = v_med1;

  v_valores := jsonb_build_object(
    'estructura_general', 60,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 60)) from unnest(v_centro_ids) as c)
  );
  v_med2 := public.registrar_medicion(v_etapa4a_id, v_valores, v_med1);
  update public.mediciones_estructura set registrada_en = (public.hoy() - 150)::timestamptz where id = v_med2;

  -- El admin NO tiene asignación sobre v_pac_mc4 -> cerrar_etapa toma el
  -- disjunto is_admin() (design §1.0/§9.3) y NO exige cerrar_etapa_con_medicion
  -- (DEC-33 solo aplica al asignado). Genera cierre_automatico a partir de
  -- v_med2 antes de cerrar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.cerrar_etapa(v_pac_mc4, 'finalizada', 'Cierre administrativo — tratamiento completo');

  update public.mediciones_estructura
     set registrada_en = (public.hoy() - 149)::timestamptz
   where etapa_id = v_etapa4a_id and momento = 'cierre_automatico';

  -- cerrar_etapa fija fecha_finalizacion = public.hoy() server-side; se la
  -- backdatea al mismo día que su cierre_automatico para que la etapa 1
  -- cierre antes de que arranque la etapa 2 (public.hoy() - 30). El estado
  -- queda 'finalizada': combinación válida con cierre_automatico porque cerró
  -- un admin sin asignación (DEC-33).
  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy() - 149
   where id = v_etapa4a_id;

  -- Segunda etapa, abierta, asignada a terapeuta1 — el "tratamiento actual".
  insert into public.etapas_tratamiento (
    id, paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_etapa4b_id, v_pac_mc4, v_ter1,
    (select id from public.causas where codigo = 'CAU-06'),
    (select id from public.algoritmos where codigo = 'ALG-46'),
    v_modalidad, public.hoy() - 30, v_est_eta_activa
  );

  perform set_config('request.jwt.claim.sub', v_ter1::text, true);

  v_valores := jsonb_build_object(
    'estructura_general', 58,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 58)) from unnest(v_centro_ids) as c)
  );
  v_med1 := public.registrar_medicion(v_etapa4b_id, v_valores, null);
  update public.mediciones_estructura set registrada_en = (public.hoy() - 30)::timestamptz where id = v_med1;

  raise notice 'medir-chakras: 4 fixtures sembradas — Sofía (3 mediciones), % (1 medición), % (última semana, alerta), % (2 etapas, cierre_automatico)',
    v_pac_mc2, v_pac_mc3, v_pac_mc4;
end $$;
