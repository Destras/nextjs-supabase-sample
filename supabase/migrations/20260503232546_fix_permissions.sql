-- Strip ALL privileges from anon on every table.
-- Unauthenticated clients should have zero direct table access; RLS will
-- govern access for authenticated users as policies are added per feature.
revoke all on table public.alfabetos from anon;
revoke all on table public.algoritmo_etapas from anon;
revoke all on table public.algoritmos from anon;
revoke all on table public.asignaciones_paciente from anon;
revoke all on table public.audit_log from anon;
revoke all on table public.bloqueos from anon;
revoke all on table public.causa_etapas from anon;
revoke all on table public.causas from anon;
revoke all on table public.contenidos from anon;
revoke all on table public.entregas_plan from anon;
revoke all on table public.estados_etapa from anon;
revoke all on table public.estados_paciente from anon;
revoke all on table public.estados_terapeuta from anon;
revoke all on table public.etapa_alfabetos from anon;
revoke all on table public.etapa_bloqueos from anon;
revoke all on table public.etapas_tratamiento from anon;
revoke all on table public.frases_motivacionales from anon;
revoke all on table public.modalidades from anon;
revoke all on table public.nivel_evaluacion from anon;
revoke all on table public.niveles from anon;
revoke all on table public.notificaciones_outbox from anon;
revoke all on table public.pacientes from anon;
revoke all on table public.plantilla_entregas from anon;
revoke all on table public.plantillas_tratamiento from anon;
revoke all on table public.profiles from anon;
revoke all on table public.roles from anon;
revoke all on table public.terapeutas from anon;
revoke all on table public.tipos_disco from anon;

-- Remove TRUNCATE and TRIGGER from authenticated on all tables.
-- TRUNCATE is a DDL-level operation (no app user should ever truncate a table).
-- TRIGGER allows attaching new triggers (DB admin operation, not app concern).
revoke truncate, trigger on table public.alfabetos from authenticated;
revoke truncate, trigger on table public.algoritmo_etapas from authenticated;
revoke truncate, trigger on table public.algoritmos from authenticated;
revoke truncate, trigger on table public.asignaciones_paciente from authenticated;
revoke truncate, trigger on table public.bloqueos from authenticated;
revoke truncate, trigger on table public.causa_etapas from authenticated;
revoke truncate, trigger on table public.causas from authenticated;
revoke truncate, trigger on table public.contenidos from authenticated;
revoke truncate, trigger on table public.entregas_plan from authenticated;
revoke truncate, trigger on table public.estados_etapa from authenticated;
revoke truncate, trigger on table public.estados_paciente from authenticated;
revoke truncate, trigger on table public.estados_terapeuta from authenticated;
revoke truncate, trigger on table public.etapa_alfabetos from authenticated;
revoke truncate, trigger on table public.etapa_bloqueos from authenticated;
revoke truncate, trigger on table public.etapas_tratamiento from authenticated;
revoke truncate, trigger on table public.frases_motivacionales from authenticated;
revoke truncate, trigger on table public.modalidades from authenticated;
revoke truncate, trigger on table public.nivel_evaluacion from authenticated;
revoke truncate, trigger on table public.niveles from authenticated;
revoke truncate, trigger on table public.notificaciones_outbox from authenticated;
revoke truncate, trigger on table public.pacientes from authenticated;
revoke truncate, trigger on table public.plantilla_entregas from authenticated;
revoke truncate, trigger on table public.plantillas_tratamiento from authenticated;
revoke truncate, trigger on table public.profiles from authenticated;
revoke truncate, trigger on table public.roles from authenticated;
revoke truncate, trigger on table public.terapeutas from authenticated;
revoke truncate, trigger on table public.tipos_disco from authenticated;

-- Restrict audit_log to INSERT-only for authenticated.
-- Audit entries must be immutable; only inserts (via server-side triggers)
-- are valid. service_role retains full access for administrative operations.
revoke delete, update, truncate, trigger on table public.audit_log from authenticated;
