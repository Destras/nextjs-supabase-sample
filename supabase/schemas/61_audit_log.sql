create table public.audit_log (
  id                uuid        not null default gen_random_uuid() primary key,
  tabla             text        not null,
  registro_id       text        not null,
  operacion         text        not null,
  usuario_id        uuid        references public.profiles (id),
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  created_at        timestamptz not null default now()
);

comment on table public.audit_log is 'Registro de auditoría genérico para tablas clínicas críticas (pacientes, etapas, niveles, evaluaciones, asignaciones).';

alter table public.audit_log enable row level security;

-- audit_log es append-only para `authenticated`: puede insertar y leer, nunca
-- modificar ni borrar. El lockdown por default privileges (00_authenticated_lockdown.sql)
-- cubre truncate/trigger para todas las tablas; delete y update son específicos
-- de esta tabla y se revocan acá. Espeja
-- 20260503232546_fix_permissions.sql:67, que lo hizo en la base real pero nunca
-- del lado declarativo.
revoke delete, update on table public.audit_log from authenticated;
