-- ---------------------------------------------------------------------------
-- documentos_legales
-- ---------------------------------------------------------------------------
-- Documentos legales versionados (consentimiento informado y términos y
-- condiciones) que el paciente de la app móvil debe aceptar al crear su
-- cuenta. Reference data: inmutable, admin-only, mantenida directamente por
-- SQL — no hay pantalla de administración en la consola web.
--
-- El contenido real (markdown) se inserta vía una migración de seed
-- hand-written (no acá):
-- supabase/migrations/20260913190000_seed_documentos_legales.sql.
-- ---------------------------------------------------------------------------

create type public.tipo_documento_legal as enum (
  'CONSENTIMIENTO_APP_PACIENTE',
  'TERMINOS_CONDICIONES_APP_PACIENTE'
);

create table public.documentos_legales (
  id           uuid                        not null default gen_random_uuid() primary key,
  tipo         public.tipo_documento_legal not null,
  version      text                        not null check (version ~ '^\d+\.\d+$'),
  titulo       text                        not null,
  contenido_md text                        not null,
  publicado_at timestamptz                 not null,
  created_at   timestamptz                 not null default now(),
  unique (tipo, version),
  unique (id, tipo)
);

comment on table public.documentos_legales is 'Documentos legales versionados (consentimiento informado y términos y condiciones) que el paciente de la app móvil debe aceptar al crear su cuenta. Inmutable: un cambio de texto es una fila nueva, nunca un UPDATE (trigger rechazar_modificacion_documentos_legales bloquea UPDATE, DELETE y TRUNCATE sin excepción, ni siquiera para service_role). unique(id, tipo) habilita la FK compuesta desde aceptaciones_documentos_legales.documento_id. "Vigente" por tipo = la fila con mayor publicado_at (ver resolver_documentos_legales_vigentes en 77_rpcs_documentos_legales.sql). Admin-only: solo lectura por SQL, sin UI en la consola.';

alter table public.documentos_legales enable row level security;

-- Inmutabilidad total: ni siquiera service_role/postgres puede modificar un
-- documento publicado. Un texto distinto es una versión nueva, siempre.
create trigger rechazar_modificacion_documentos_legales
  before update or delete on public.documentos_legales
  for each row execute function public.rechazar_modificacion();

create trigger rechazar_truncate_documentos_legales
  before truncate on public.documentos_legales
  for each statement execute function public.rechazar_modificacion();

-- Grant base de SELECT a authenticated: en este proyecto las tablas creadas
-- vía schema declarativo (a diferencia de pacientes, otorgada en el
-- 20260503204655_initial_schema.sql original) NO reciben SELECT por default
-- privileges — solo REFERENCES/TRIGGER/TRUNCATE (ver pg_default_acl del rol
-- postgres). Sin este grant explícito, la policy admin_select_all_* de
-- arriba es inalcanzable: RLS nunca se evalúa si falta el privilegio de
-- tabla de base. Confirmado en local con has_table_privilege('authenticated',
-- 'public.documentos_legales', 'select') = false antes de este grant.
grant select on table public.documentos_legales to authenticated;

-- Grant explícito de SELECT a service_role: por default privileges de este
-- proyecto, service_role tampoco recibe SELECT en tablas nuevas (solo
-- REFERENCES/TRIGGER/TRUNCATE). El vault (vault de producto) lee los
-- documentos vigentes por REST con la service-role key
-- (documentos_legales?select=tipo,version,publicado_at&order=publicado_at.desc)
-- — sin este grant esa lectura falla con "permission denied for table
-- documentos_legales".
grant select on table public.documentos_legales to service_role;

-- Defensa en profundidad más allá de RLS (TRUNCATE la ignora por completo, y
-- sin estos revokes un INSERT/UPDATE de authenticated fallaría solo porque no
-- hay policy que lo permita — un detalle frágil de RLS, no un control real).
-- anon ya no tiene privilegios de tabla (00_anon_lockdown.sql); estos revokes
-- documentan la intención explícita para esta tabla.
revoke insert, update, delete on table public.documentos_legales from authenticated;
revoke insert, update, delete on table public.documentos_legales from anon;

-- Matriz de privilegios explícita para service_role: SELECT-only, sin
-- importar qué otorgan las default privileges de este proyecto en tablas
-- nuevas (ver 20260913183051_consentimiento_documentos_legales_schema.sql
-- para el detalle CLI-version-dependent de este gap). El seed inserta como
-- postgres (migración de seed), nunca como service_role, así que revocar
-- INSERT no rompe nada. UPDATE/DELETE/TRUNCATE ya están bloqueados por
-- trigger; este revoke los cierra también a nivel de grant.
revoke insert, update, delete, truncate on table public.documentos_legales from service_role;
