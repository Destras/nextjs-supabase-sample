-- ---------------------------------------------------------------------------
-- aceptaciones_documentos_legales
-- ---------------------------------------------------------------------------
-- Evidencia insert-only de que un paciente aceptó un documento legal
-- (consentimiento o términos) al crear su cuenta en la app móvil. Insertada
-- por vincular_cuenta_paciente (73_otps_functions.sql) dentro de la
-- misma transacción que el link de cuenta y el consumo del OTP.
-- ---------------------------------------------------------------------------

create table public.aceptaciones_documentos_legales (
  id           uuid                        not null default gen_random_uuid() primary key,
  paciente_id  uuid                        not null references public.pacientes (id) on delete restrict,
  user_id      uuid,
  documento_id uuid                        not null,
  tipo         public.tipo_documento_legal not null,
  aceptado_at  timestamptz                 not null default now(),
  unique (paciente_id, documento_id),
  foreign key (documento_id, tipo) references public.documentos_legales (id, tipo) on delete restrict
);

comment on table public.aceptaciones_documentos_legales is 'Evidencia insert-only de que un paciente aceptó un documento legal al crear su cuenta en la app. user_id se guarda SIN foreign key a auth.users a propósito: la baja voluntaria borra la cuenta de auth (auth.admin.deleteUser) y esta fila debe sobrevivir como evidencia, sin 23503 ni cascada. paciente_id referencia pacientes, que nunca se borra físicamente. La FK compuesta (documento_id, tipo) contra documentos_legales(id, tipo) mantiene el snapshot honesto: no se puede aceptar un documento con un tipo distinto al que realmente tiene. Bloquea UPDATE para todos los roles (trigger rechazar_modificacion_aceptaciones_documentos_legales); permite DELETE únicamente a service_role — sin trigger de DELETE a propósito, porque vault de producto/scripts/utils/purge-test-paciente.mjs borra pacientes de prueba fila por fila con service_role y un trigger de DELETE lo rompería. anon/authenticated no tienen DELETE (revocado explícitamente más abajo).';

alter table public.aceptaciones_documentos_legales enable row level security;

create index aceptaciones_documentos_legales_documento_id_idx
  on public.aceptaciones_documentos_legales (documento_id);

-- Solo UPDATE se bloquea con trigger de fila (insert-only). DELETE se deja
-- abierto a nivel de trigger para no romper el purge de pacientes de prueba;
-- el control de acceso al DELETE es el grant de abajo (service_role
-- únicamente — DELETE, nunca TRUNCATE).
create trigger rechazar_modificacion_aceptaciones_documentos_legales
  before update on public.aceptaciones_documentos_legales
  for each row execute function public.rechazar_modificacion();

-- TRUNCATE sí se bloquea, para todos los roles sin excepción (incluido
-- service_role, que hereda el privilegio TRUNCATE por default privileges de
-- este proyecto en tablas nuevas — mismo gap documentado en
-- 23_documentos_legales.sql). Solo se aprobó DELETE filtrado por
-- service_role (purge-test-paciente.mjs); TRUNCATE ignora RLS y cualquier
-- WHERE, así que necesita su propio guard, igual que documentos_legales.
create trigger rechazar_truncate_aceptaciones_documentos_legales
  before truncate on public.aceptaciones_documentos_legales
  for each statement execute function public.rechazar_modificacion();

-- Grant base de SELECT a authenticated: sin esto la policy de arriba es
-- inalcanzable en este proyecto (ver comentario equivalente en
-- 23_documentos_legales.sql — las tablas creadas por schema declarativo no
-- reciben SELECT por default privileges).
grant select on table public.aceptaciones_documentos_legales to authenticated;

-- Grant explícito de SELECT + DELETE a service_role: por
-- default privileges de este proyecto, service_role tampoco recibe DELETE en
-- tablas nuevas (solo REFERENCES/TRIGGER/TRUNCATE), así que sin el grant de
-- DELETE purge-test-paciente.mjs no podría borrar filas de prueba pese a que
-- no hay trigger que lo bloquee. SELECT es igual de necesario: un
-- "DELETE ... WHERE paciente_id = ..." (exactamente lo que hace el script)
-- requiere que Postgres evalúe el predicado WHERE, lo cual exige el
-- privilegio SELECT además de DELETE — confirmado en local: DELETE-only
-- devuelve "permission denied for table aceptaciones_documentos_legales".
grant select, delete on table public.aceptaciones_documentos_legales to service_role;

-- Defensa en profundidad más allá de RLS. DELETE se deja FUERA de este
-- revoke a propósito para authenticated: default privileges de este proyecto
-- YA no se lo da (confirmado arriba), pero lo revocamos explícito igual para
-- que quede documentado, y nunca se toca para service_role (ver
-- comment on table).
revoke insert, update, delete on table public.aceptaciones_documentos_legales from authenticated;
revoke insert, update, delete on table public.aceptaciones_documentos_legales from anon;

-- Matriz de privilegios explícita para service_role: SELECT+DELETE-only, sin
-- importar qué otorgan las default privileges de este proyecto en tablas
-- nuevas (ver 20260913183051_consentimiento_documentos_legales_schema.sql
-- para el detalle CLI-version-dependent de este gap). vincular_cuenta_paciente
-- inserta corriendo como security definer (el owner de la función, nunca
-- service_role), así que revocar INSERT no rompe nada. UPDATE ya está
-- bloqueado por trigger; TRUNCATE por su propio trigger de statement. Este
-- revoke cierra ambos a nivel de grant también, y deja DELETE intacto
-- (purge-test-paciente.mjs lo necesita).
revoke insert, update, truncate on table public.aceptaciones_documentos_legales from service_role;
