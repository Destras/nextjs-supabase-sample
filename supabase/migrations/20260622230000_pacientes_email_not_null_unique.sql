-- ---------------------------------------------------------------------------
-- Migration: pacientes_email_not_null_unique
-- ---------------------------------------------------------------------------
-- Makes pacientes.email NOT NULL and adds a unique index (pacientes_email_key).
--
-- ORDER OF OPERATIONS (critical — must run in this sequence):
--   1. Backfill: assign unique emails to the 8 seed pacientes that currently
--      have email = null (pac5..pac12, UUIDs d0000005..d000000c).
--   2. ALTER COLUMN: set not null constraint on pacientes.email.
--   3. CREATE INDEX: add the unique index pacientes_email_key.
--
-- BACKFILL ASSUMPTION (pre-demo only):
--   The remote database contains only seed data — no real patients with a
--   null email. If real patients with null emails ever exist before this
--   migration is applied, DO NOT run it blindly. Coordinate with the business
--   to assign real emails first; do not invent emails for real patients.
--   The backfill values below are test-domain addresses (@paciente.test) that
--   match the naming pattern already used by pac1..pac4 in the seed.
--
-- Docker not available in WSL2 → hand-crafted (no supabase db diff).
-- Mirrors the pattern of 20260622220000_validar_otp.sql.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Step 1 — Backfill null emails with deterministic test addresses.
--           Each UUID matches the fixed pk declared in supabase/seed.sql.
-- ---------------------------------------------------------------------------
update public.pacientes
   set email = 'lucia.fernandez@paciente.test'
 where id = 'd0000005-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'pedro.suarez@paciente.test'
 where id = 'd0000006-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'camila.acosta@paciente.test'
 where id = 'd0000007-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'tomas.vega@paciente.test'
 where id = 'd0000008-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'renata.castro@paciente.test'
 where id = 'd0000009-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'joaquin.pereyra@paciente.test'
 where id = 'd000000a-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'felipe.romero@paciente.test'
 where id = 'd000000b-0000-0000-0000-000000000000'
   and email is null;

update public.pacientes
   set email = 'agustina.mendez@paciente.test'
 where id = 'd000000c-0000-0000-0000-000000000000'
   and email is null;

-- ---------------------------------------------------------------------------
-- Step 2 — Enforce NOT NULL now that all rows have an email value.
--           Will fail if any row still has email = null (safety net).
-- ---------------------------------------------------------------------------
alter table public.pacientes
  alter column email set not null;

-- ---------------------------------------------------------------------------
-- Step 3 — Add unique index.
--           Enforces one account per email address across all pacientes.
-- ---------------------------------------------------------------------------
create unique index pacientes_email_key on public.pacientes (email);
