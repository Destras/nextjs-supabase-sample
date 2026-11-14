-- EXECUTE grants for sdd/medir-chakras PR1 (E0). Hand-authored on purpose —
-- migra does not detect EXECUTE grants or proconfig (.claude/skills/supabase-migration/SKILL.md,
-- .claude/supabase-declarative-database-schema.md "Known caveats"). Same
-- pattern as 20260831140100_baja_voluntaria_paciente_grants.sql and
-- 20260913183100_documentos_legales_resolver_grants.sql.
--
-- 🔴 MUST run in the SAME `db push` as M4
-- (20260920210300_cierre_con_medicion_y_alertas.sql), and AFTER it. M4
-- `create or replace`s derive_alertas_activas and baja_voluntaria_paciente —
-- two functions whose access control is exactly the revokes below, nothing
-- else. This project's `alter default privileges for role postgres in
-- schema public grant execute on functions to authenticated, service_role`
-- (verified at supabase/schemas/76_rpcs_baja_voluntaria.sql:179-185) means
-- every `create or replace` re-grants EXECUTE to `authenticated`
-- unconditionally. Between M4 committing and this file running, any
-- authenticated patient could call baja_voluntaria_paciente(<another
-- patient's uuid>) and deactivate their account. Never ship M4 alone.
--
-- The revoke list below is the design §2.5 exhaustive `create or replace`
-- inventory (13 rows), NOT the DEC-34 prose in
-- sdd/medir-chakras/grill-decisions (#317) — that prose over-included
-- semanas_de_etapa, corrected in sdd/medir-chakras/dec34-correction (#322):
-- semanas_de_etapa is only CALLED from the extended derive_alertas_activas
-- CTE, never `create or replace`d by this change, so its existing revokes
-- (44_semanas_de_etapa.sql:56-57) are undisturbed and it needs no statement
-- here — it stays only in the privilege_lockdown-style regression assert
-- (supabase/tests/mediciones_estructura.sql).
--
-- Verification (supabase/tests/mediciones_estructura.sql +
-- supabase/tests/baja_voluntaria.sql assert A11, both required after
-- `db reset`):
--   select has_function_privilege('authenticated', 'public.baja_voluntaria_paciente(uuid)', 'execute'); -- must be false
--   select has_function_privilege('authenticated', 'public.get_estructura_paciente(uuid)', 'execute');  -- must be true

-- ---------------------------------------------------------------------------
-- Table-level hardening — the three new tables (M1,
-- 20260920210000_mediciones_estructura_fundacion.sql ⇄ schemas/45,46,47)
-- have no write RLS policy for any role (design §8.1). Without these
-- revokes, the project's `alter default privileges for role postgres in
-- schema public grant all on tables to authenticated`
-- (00_authenticated_lockdown.sql) leaves authenticated able to INSERT/
-- UPDATE/DELETE at the table-privilege level — RLS then denies the write
-- only because no policy permits it, a fragile side effect, not a real
-- control. Matches documentos_legales (23_documentos_legales.sql). Added
-- here (not in M1) after supabase/tests/privilege_lockdown.sql BLOCK 4
-- caught the gap on first run — see supabase/tests/mediciones_estructura.sql
-- for the empirical set-role INSERT-rejection proof.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.centros_energeticos  from authenticated;
revoke insert, update, delete on table public.mediciones_estructura from authenticated;
revoke insert, update, delete on table public.medicion_valores      from authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs — new in M3 (20260920210200_rpcs_mediciones.sql)
-- ---------------------------------------------------------------------------

grant execute on function public.get_estructura_paciente(uuid)                     to authenticated;
grant execute on function public.registrar_medicion(uuid, jsonb, uuid)             to authenticated;
grant execute on function public.editar_medicion(uuid, jsonb)                      to authenticated;
grant execute on function public.cerrar_etapa_con_medicion(uuid, text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs — replaced in M4, restated idempotently so this file is the
-- full picture of who can call what after this change.
-- ---------------------------------------------------------------------------

grant execute on function public.cerrar_etapa(uuid, text, text)           to authenticated;
grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers — new in M3. Three roles each, per the
-- 76_rpcs_baja_voluntaria.sql:186-188 precedent. `revoke ... from
-- service_role` is NOT applied: baja_voluntaria_paciente runs as
-- service_role and calls _generar_cierre_automatico.
-- ---------------------------------------------------------------------------

revoke execute on function public._validar_valores_medicion(jsonb, uuid[]) from public, anon, authenticated;
revoke execute on function public._medicion_editable(uuid)                 from public, anon, authenticated;
revoke execute on function public._insertar_medicion(uuid, text, jsonb)    from public, anon, authenticated;
revoke execute on function public._generar_cierre_automatico(uuid)         from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private engine replaced in M4 — MUST be re-revoked, `create or replace`
-- re-triggered the default privilege grant to `authenticated`.
-- ---------------------------------------------------------------------------

revoke execute on function public.derive_alertas_activas() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 🔴 CRITICAL — replaced in M4; these revokes+grant are baja_voluntaria_paciente's
-- ENTIRE access control (its body has no ownership check, see design §2.4).
-- ---------------------------------------------------------------------------

revoke execute on function public.baja_voluntaria_paciente(uuid) from public, anon, authenticated;
grant  execute on function public.baja_voluntaria_paciente(uuid) to service_role;
