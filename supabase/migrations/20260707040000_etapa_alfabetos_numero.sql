-- ---------------------------------------------------------------------------
-- Migration: etapa_alfabetos_numero
-- ---------------------------------------------------------------------------
-- Adds the nullable etapa_alfabetos.numero column (per DEC-01 / DEC-05 of
-- nuevoTratamiento epic-0). Purely additive — no backfill, no not null,
-- PK (etapa_id, alfabeto_id) and existing RLS policies are untouched.
--
-- Hand-authored: `supabase db diff` is broken by a pre-existing schema
-- ordering bug (public.is_admin() is used in supabase/schemas/11_profiles.sql
-- before being defined in supabase/schemas/25_admin_functions.sql), so the
-- diff tool cannot build the shadow "desired state" database for ANY schema
-- change today.
-- ---------------------------------------------------------------------------
alter table public.etapa_alfabetos
  add column numero int;
