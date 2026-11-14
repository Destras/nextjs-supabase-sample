-- ---------------------------------------------------------------------------
-- centros_energeticos
-- ---------------------------------------------------------------------------
-- Catálogo de referencia de los 12 centros energéticos medibles en la
-- pestaña Estructura (feature medirChakras). No dispara nada por sí solo —
-- mismo rol que tipos_alerta (63_tipos_alerta.sql): metadata de presentación
-- que otras piezas consumen.
--
-- `orden` fija el orden de catálogo que usan el formulario de medición
-- (construirCampos, PR3) y la matriz de Historia (HistMediciones, PR5).
-- `activo` permite desactivar un centro sin borrar el historial de
-- mediciones que ya lo usaron: medicion_valores.centro_id nunca reinterpreta
-- el catálogo (design §1.5) — una medición vieja conserva el centro que
-- midió, con su nombre, aunque se desactive después.
--
-- `etiqueta_paciente` es un wording orientado al paciente, deliberadamente
-- separado de `nombre` (el nombre clínico/interno). Arranca igual a `nombre`
-- (OD-4, abierta — el wording final se define antes del spec mobile).
-- ---------------------------------------------------------------------------

create table public.centros_energeticos (
  id                uuid        not null default gen_random_uuid() primary key,
  codigo            text        not null unique,
  nombre            text        not null,
  etiqueta_paciente text        not null,
  orden             int         not null unique,
  activo            boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.centros_energeticos is
  'Catálogo de referencia de los 12 centros energéticos medibles (medirChakras). No dispara nada por sí solo. activo permite desactivar un centro sin borrar su historial: medicion_valores nunca reinterpreta el catálogo, una medición vieja conserva el centro que midió aunque se desactive después.';

comment on column public.centros_energeticos.etiqueta_paciente is
  'Wording orientado al paciente (OD-4, abierta): arranca igual a nombre.';

comment on column public.centros_energeticos.orden is
  'Orden de catálogo: el que usan el formulario de medición y la matriz de Historia.';

alter table public.centros_energeticos enable row level security;

create trigger set_centros_energeticos_updated_at
  before update on public.centros_energeticos
  for each row execute function public.set_updated_at();

-- Sin policy de insert/update/delete: catálogo de solo lectura (design §8.1),
-- mismo patrón que tipos_alerta. No hay ruta de CRUD desde la consola.

-- Table-level grants — NO son automáticos para tablas nuevas en este
-- proyecto. Mismo hallazgo que
-- 20260913183051_consentimiento_documentos_legales_schema.sql: el default
-- ACL del rol postgres no otorga select a `authenticated` en tablas nuevas
-- (a diferencia de las tablas del initial_schema.sql original), así que sin
-- este grant la policy de arriba nunca se alcanza (falta el privilegio de
-- tabla de base, RLS ni siquiera se evalúa). `authenticated` SÍ hereda
-- TRUNCATE/TRIGGER por default (00_authenticated_lockdown.sql documenta el
-- mecanismo), pero ese revoke declarativo nunca corrió contra la base real
-- (mismo gap que vigila el test de privilegios) — se
-- revoca acá explícito para no depender de que alguien lo recuerde.
grant select on table public.centros_energeticos to authenticated;
revoke truncate, trigger on table public.centros_energeticos from authenticated;

-- Defensa en profundidad más allá de RLS (no hay policy de escritura para
-- ningún rol, design §8.1): sin este revoke, un INSERT/UPDATE/DELETE de
-- authenticated fallaría solo porque falta policy que lo permita — un
-- detalle frágil de RLS, no un control real. Mismo patrón que
-- documentos_legales (23_documentos_legales.sql).
revoke insert, update, delete on table public.centros_energeticos from authenticated;

-- Seed del catálogo (design §2, M2): 12 filas, orden per ProductSpec §2.3.
-- etiqueta_paciente = nombre (OD-4, abierta). on conflict (codigo) do nothing:
-- idempotente, igual patrón que tipos_alerta (63_tipos_alerta.sql) — deben
-- existir dondequiera que corran las migraciones, incluido `db push`, que NO
-- corre supabase/seed.sql.
insert into public.centros_energeticos (codigo, nombre, etiqueta_paciente, orden) values
  ('corona',             'Corona',              'Corona',              1),
  ('frente',             'Frente',              'Frente',             2),
  ('tercer_ojo',         'Tercer Ojo',          'Tercer Ojo',             3),
  ('hombros',            'Hombros',             'Hombros',         4),
  ('brazos',             'Brazos',              'Brazos',       5),
  ('garganta',           'Garganta',            'Garganta',            6),
  ('cardiaco',           'Cardíaco',            'Cardíaco',            7),
  ('plexo_solar',        'Plexo Solar',         'Plexo Solar',         8),
  ('sacro',              'Sacro',               'Sacro',              9),
  ('raiz',               'Raíz',                'Raíz',           10),
  ('piernas',            'Piernas',             'Piernas',  11),
  ('columna',            'Columna',             'Columna', 12)
on conflict (codigo) do nothing;
