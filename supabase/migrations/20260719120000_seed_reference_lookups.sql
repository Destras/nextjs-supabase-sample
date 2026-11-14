-- Catálogo de referencia de producción: roles, estados_paciente, estados_etapa
-- (base), tipos_disco, alfabetos y modalidades. Filas de referencia, no de
-- ejemplo: deben existir dondequiera que corran las migraciones, incluido
-- `db push` (que NO corre supabase/seed.sql). Mirrors el precedente de
-- 20260705120000_tipos_alerta.sql y 20260524175444_seed_estados_terapeuta.sql.
--
-- CRÍTICO: los UUIDs son literales copiados verbatim del `declare` block de
-- supabase/seed.sql. seed.sql inserta la data mock referenciando estos
-- mismos UUIDs como valores de FK literales (no por lookup de `codigo`); si
-- estos valores cambian, todas las FKs del árbol mock rompen en `db reset`.
--
-- Excluye estados_terapeuta (20260524175444_seed_estados_terapeuta.sql) y
-- tipos_alerta (20260705120000_tipos_alerta.sql + fundacion) — ya cubiertas
-- por migraciones existentes.
--
-- Idempotente: `on conflict (codigo) do nothing` en cada insert.

-- =====================================================
-- 1. roles
-- =====================================================
insert into public.roles (id, codigo, nombre, descripcion) values
  ('a1000001-0000-0000-0000-000000000000', 'admin',     'Administrador', 'Acceso total al sistema'),
  ('a1000002-0000-0000-0000-000000000000', 'terapeuta', 'Terapeuta',     'Acceso a sus pacientes asignados'),
  ('a1000003-0000-0000-0000-000000000000', 'paciente',  'Paciente',      'Acceso a su propio plan de tratamiento')
on conflict (codigo) do nothing;

-- =====================================================
-- 2. estados_paciente
-- =====================================================
insert into public.estados_paciente (id, codigo, nombre, descripcion) values
  ('a3000001-0000-0000-0000-000000000000', 'activo',  'Activo',  'Paciente en tratamiento activo'),
  ('a3000002-0000-0000-0000-000000000000', 'pausado', 'Pausado', 'Tratamiento temporalmente pausado')
on conflict (codigo) do nothing;

-- =====================================================
-- 3. estados_etapa (base: activa/finalizada/abandonada)
-- =====================================================
-- 'pendiente' (a4000004) es propiedad de 20260712040000_inicio_tratamiento_fundacion.sql
-- — no se duplica acá.
insert into public.estados_etapa (id, codigo, nombre, descripcion) values
  ('a4000001-0000-0000-0000-000000000000', 'activa',     'Activa',     'Etapa de tratamiento en curso'),
  ('a4000002-0000-0000-0000-000000000000', 'finalizada', 'Finalizada', 'Etapa completada exitosamente'),
  ('a4000003-0000-0000-0000-000000000000', 'abandonada', 'Abandonada', 'Etapa interrumpida antes de completar')
on conflict (codigo) do nothing;

-- =====================================================
-- 4. tipos_disco
-- =====================================================
insert into public.tipos_disco (id, codigo, nombre, descripcion) values
  ('a8000001-0000-0000-0000-000000000000', 'RIO',    'Disco Río',
   'Modalidad terapéutica que trabaja con la energía del flujo y la adaptabilidad, ideal para procesar emociones bloqueadas'),
  ('a8000002-0000-0000-0000-000000000000', 'BOSQUE', 'Disco Bosque',
   'Modalidad terapéutica que trabaja con la energía del arraigo y la regeneración, ideal para sanar traumas'),
  ('a8000003-0000-0000-0000-000000000000', 'AGUA',   'Disco Agua',
   'Modalidad terapéutica que trabaja con la energía de la purificación y la renovación profunda')
on conflict (codigo) do nothing;

-- =====================================================
-- 5. alfabetos
-- =====================================================
insert into public.alfabetos (id, codigo, nombre, descripcion) values
  ('a9000001-0000-0000-0000-000000000000', 'FUEGO',  'Alfabeto Fuego',
   'Sistema de símbolos terapéuticos que activa la transformación y la acción. Trabaja sobre patrones de bloqueo en centros inferiores'),
  ('a9000002-0000-0000-0000-000000000000', 'TIERRA', 'Alfabeto Tierra',
   'Sistema de símbolos terapéuticos que estabiliza y arraiga. Trabaja sobre patrones de inseguridad y desconexión'),
  ('a9000003-0000-0000-0000-000000000000', 'VIENTO', 'Alfabeto Viento',
   'Sistema de símbolos terapéuticos que libera y expande. Trabaja sobre patrones de rigidez mental y emocional')
on conflict (codigo) do nothing;

-- =====================================================
-- 6. modalidades (después de tipos_disco: FK modalidades.tipo_disco_id)
-- =====================================================
insert into public.modalidades (id, codigo, nombre, tipo_disco_id, cantidad_sesiones, cantidad_niveles, cadencia_descripcion, duracion_meses_estimada) values
  ('b2000002-0000-0000-0000-000000000000',
   'M_BOSQUE_16',
   'Modalidad Bosque — 16 discos',
   'a8000002-0000-0000-0000-000000000000', 16, 4,
   'Plan de 16 discos distribuidos en 4 niveles mensuales a lo largo de 4 meses.',
   4),
  ('b2000004-0000-0000-0000-000000000000',
   'M_RIO_16',
   'Modalidad Río — 16 discos',
   'a8000001-0000-0000-0000-000000000000', 16, 4,
   'Plan de 16 discos distribuidos en 4 niveles mensuales a lo largo de 4 meses.',
   4),
  ('b2000003-0000-0000-0000-000000000000',
   'M_RIO_32',
   'Modalidad Río — 32 discos',
   'a8000001-0000-0000-0000-000000000000', 32, 4,
   'Plan extendido de 32 discos distribuidos en 4 niveles mensuales a lo largo de 4 meses.',
   4),
  ('b2000005-0000-0000-0000-000000000000',
   'M_BOSQUE_32',
   'Modalidad Bosque — 32 discos',
   'a8000002-0000-0000-0000-000000000000', 32, 4,
   'Plan extendido de 32 discos distribuidos en 4 niveles mensuales a lo largo de 4 meses.',
   4)
on conflict (codigo) do nothing;
