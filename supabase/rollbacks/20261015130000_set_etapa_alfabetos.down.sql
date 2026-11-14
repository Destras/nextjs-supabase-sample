-- =============================================================================
-- Rollback de 20261015130000_set_etapa_alfabetos.sql (alfabetosReales, Task 1.1)
-- =============================================================================

begin;

drop function if exists public.set_etapa_alfabetos(uuid, jsonb);

commit;
