---
name: supabase-rls-policy
description: Genera, valida localmente y prepara para push una política RLS de Supabase. Inspecciona el estado actual via MCP (RLS habilitado, políticas existentes, índices en FKs), arma una migración versionada y la prueba contra usuarios seed antes de devolver el control. Use when the user wants to create, change, debug or audit an RLS policy, restrict who can see/edit a table, add row-level security, work on permisos, acceso, políticas, "quién puede ver/editar X", "restringir acceso", "lock down access", "read-only access". Does NOT handle schema changes (use supabase-db-manager) or non-policy SQL (use supabase-migration).
---

# Supabase RLS Policy

Guided, safety-first workflow for Supabase Row-Level Security policies. RLS is on the declarative-schema **caveat list** (`.claude/supabase-declarative-database-schema.md`) — policies must go through versioned migrations under `supabase/migrations/`, never `supabase/schemas/`.

This skill never pushes to remote. It writes the migration, applies it locally, probes against seed users via the Supabase MCP, and hands the push command back to the user.

## Scope boundary

| Request shape                                                  | Skill                                              |
| -------------------------------------------------------------- | -------------------------------------------------- |
| "Add a policy / RLS / restrict access / who can see X"         | **This skill**                                     |
| "Add/remove/modify a column or table" / "create entity"        | `supabase-db-manager`                              |
| "Author a raw migration / DML / view ownership / `comment on`" | `supabase-migration`                               |
| Non-policy SQL                                                 | Politely defer — explain you only handle policies. |

If the user mixes requests (e.g. "add a `published` column AND a policy that hides drafts"), do the schema change via `supabase-db-manager` first, then re-invoke this skill for the policy.

---

## The 5-Phase Workflow

---

### Phase 1 — Capture intent

If the request was not fully described inline, clarify three things before moving on:

1. **Subject role** — who is the policy for? `terapeuta` / `paciente` / `admin` / `anon` / `authenticated` (any logged-in user). Cross-reference `supabase/seed-credentials.md` for the user-type taxonomy if you're unsure.
2. **Target table(s)** — schema-qualified, plural snake_case (e.g. `public.evaluaciones`).
3. **Operation(s)** — `select` / `insert` / `update` / `delete`. PostgreSQL does **not** allow multiple operations in a single `for` clause — if the intent maps to several ops ("terapeutas can do everything on asignaciones"), expand to one policy per op in Phase 3.

Accept any format: natural language, pseudo-code, partial SQL. Spanish or English.

---

### Phase 2 — Inspect current state (run in parallel)

**A. Read local files**

In parallel, read:

- `supabase/schemas/<target_table>.sql` for each table the policy touches (confirms the column names and types the policy will reference).
- `docs/rls/` — documentation of the project policy model and style (the policy SQL itself is not published in this repo).
- `supabase/seed-credentials.md` — the user/role matrix the verification probe will use in Phase 5.

**B. Inspect the live database via the Supabase MCP**

First load the MCP tool:

```
ToolSearch: "supabase execute sql"
```

Then run these three queries via `mcp__supabase__execute_sql` (in parallel):

```sql
-- Is RLS enabled on the target table?
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = '<target_table>';
```

```sql
-- What policies already exist on the target table?
select
  pol.polname as policy_name,
  pol.polcmd as command,
  (select array_agg(r.rolname) from pg_roles r where r.oid = any(pol.polroles)) as roles,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
from pg_policy pol
where pol.polrelid = 'public.<target_table>'::regclass;
```

```sql
-- Are the FK columns the policy will filter on indexed?
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = '<target_table>';
```

If the policy joins another table via `IN (select ...)`, also run the indexes query against that other table.

Note three things from the results:

- **`rls_enabled = false`** → flag for auto-fix in Phase 3.
- **Existing policy with same `for` operation and overlapping role(s)** → flag in Phase 4 (policies are additive when `as permissive`, so a second permissive `select` is OR-ed — usually wrong if you meant to _replace_ the first).
- **FK column with no index** that the new policy filters on → flag for auto-fix in Phase 3.

---

### Phase 3 — Generate SQL

Produce one `create policy` statement per operation. Match the style documented in `docs/rls/README.md`.

**Naming**

`<role>_<op>_<scope>` — snake_case, no spaces, lowercase, no period. Examples:

- `terapeuta_select_own_asignaciones`
- `paciente_insert_own_evaluacion`
- `terapeuta_update_assigned_pacientes`
- `admin_delete_any_paciente`

**`auth.uid()` form**

ALWAYS wrap as `(select auth.uid())`. Same for `auth.jwt()`. This triggers an `initPlan` so Postgres caches the result per statement instead of evaluating it per row.

```sql
-- correct
using (terapeuta_id = (select auth.uid()))

-- wrong — bare auth.uid() is a perf regression
using (terapeuta_id = auth.uid())
```

**Cross-table policies**

Use uncorrelated `IN (select ...)` — never correlated `EXISTS`.

```sql
-- correct — uncorrelated subquery, runs once per statement
using (
  id in (
    select paciente_id
    from public.asignaciones_paciente
    where terapeuta_id = (select auth.uid())
  )
)

-- wrong — correlated EXISTS runs once per row
using (
  exists (
    select 1
    from public.asignaciones_paciente
    where asignaciones_paciente.paciente_id = pacientes.id
      and asignaciones_paciente.terapeuta_id = auth.uid()
  )
)
```

**Required clauses**

| Operation | Has `using` | Has `with check` |
| --------- | :---------: | :--------------: |
| `select`  |     yes     |        no        |
| `insert`  |     no      |       yes        |
| `update`  |     yes     |       yes        |
| `delete`  |     yes     |        no        |

**Required structure for every policy**

```sql
create policy "<role>_<op>_<scope>"
  on "public"."<table>"
  as permissive
  for <op>
  to <role>
  using ( ... )         -- or with check ( ... ), per the table above
;
```

- Always specify `as permissive` (see anti-patterns for `as restrictive`).
- Always specify `to <role>` — typically `to authenticated`. Use `to authenticated, anon` only for public-read tables. Never omit the `to` clause.
- The clause order is `as` → `for` → `to` → `using` / `with check`. Any other order is invalid.
- Quote table names as `"public"."<table>"` to match the existing migration.
- Inside string literals use double apostrophe to escape (`'Night''s watch'`).

**Auto-include fixes flagged in Phase 2**

In the same migration file, prepend any RLS-enable statements and append any index creations.

```sql
-- prepend if Phase 2 found rls_enabled = false
alter table public.<table> enable row level security;

-- append if Phase 2 found an unindexed FK that the policy filters on
create index if not exists idx_<table>_<col>
  on public.<table> using btree (<col>);
```

**MFA / role-claim helpers**

To gate on Multi-Factor Authentication, use:

```sql
using ((select auth.jwt() ->> 'aal') = 'aal2')
```

This is one of the few legitimate uses of `as restrictive` (Phase 4 anti-patterns).

To read custom role data from `app_metadata` (never `user_metadata` — users can update that themselves):

```sql
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
```

---

### Phase 4 — Confirmation #1 (review SQL)

Print the full proposed migration content with this summary:

```
## RLS Policy Migration Summary

### Tables touched
[list of public.<table>]

### Operations covered
[role × op pairs — e.g. "terapeuta × select on pacientes"]

### Auto-included fixes
- RLS enable: [list of tables, or "none"]
- Indexes: [list, or "none"]

### Anti-patterns refused
[list any user requests that were rewritten — e.g. "expanded FOR ALL into 4 policies", or "none"]

### Overlap check
[list any pre-existing policies with the same role × op, or "none"]

### Risk level: LOW | MEDIUM | HIGH
- LOW: additive permissive policy on a table that already has RLS and similar policies.
- MEDIUM: first policy on a table that just had RLS enabled — anything not matched will be denied to that role.
- HIGH: replaces or overlaps an existing policy; or affects a table with > 10k rows; or restrictive policy.
```

**Stop and wait for explicit user confirmation before writing any file.**

---

### Anti-patterns the skill must handle

| Pattern                                         | Action                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `for all`                                       | **Hard refuse.** Auto-expand to 4 policies (one per op) with consistent `using` / `with check` clauses.                                    |
| `as restrictive`                                | **Warn-and-justify.** Only emit when the user explicitly justifies it (MFA, time-window, geo-fence). Otherwise rewrite as `as permissive`. |
| Bare `auth.uid()` / `auth.jwt()`                | **Rewrite** as `(select auth.uid())` / `(select auth.jwt())`.                                                                              |
| Correlated `exists (...)` joining another table | **Rewrite** as uncorrelated `IN (select ...)`.                                                                                             |
| Policy without a `to <role>` clause             | **Refuse.** Always specify the role.                                                                                                       |
| Wrong clause order (e.g. `to` before `for`)     | **Rewrite** to canonical order: `as` → `for` → `to` → `using` / `with check`.                                                              |
| Single apostrophe in SQL string literals        | **Rewrite** as double apostrophe.                                                                                                          |
| Reading authz data from `user_metadata`         | **Refuse.** `raw_user_meta_data` is user-editable. Use `raw_app_meta_data` via `auth.jwt() -> 'app_metadata'`.                             |
| Anything that is not an RLS policy              | **Defer.** Schema → `supabase-db-manager`. Raw migration / DML / view grant → `supabase-migration`.                                        |

---

### Phase 5 — Apply locally, probe, hand off

On user "yes":

1. **Write the migration file.** Filename:

   ```
   supabase/migrations/<YYYYMMDDHHMMSS>_<descriptive>_rls_policies.sql
   ```

   The timestamp is `date -u +%Y%m%d%H%M%S`. The descriptive part is snake_case and reflects the scope — e.g. `paciente_evaluaciones`, `admin_full_access`, `mfa_gated_updates`. Mirror the naming of the existing `20260504153826_terapeuta_rls_policies.sql`.

2. **Apply locally.** Ask the user once which they prefer:
   - `npx supabase migration up` — applies pending migrations on top of current local state (faster, preserves any local data).
   - `npx supabase db reset` — wipes the local DB, re-applies all migrations and the seed file (cleaner, slower).

   Run the chosen command via Bash and verify it exited 0. If it failed, show the error and stop — do not run the probe.

3. **Run the verification probe.** For each relevant role from `supabase/seed-credentials.md`, run via `mcp__supabase__execute_sql`:

   ```sql
   set local role authenticated;
   set local request.jwt.claims to (
     select json_build_object('sub', id)::text
     from auth.users
     where email = '<seed-email>'
   );
   select count(*) as visible_rows from public.<table>;
   reset role;
   ```

   Probe at minimum:
   - One user per _gated_ role (e.g. `terapeuta1@clienteapp.test` AND `terapeuta2@clienteapp.test` to confirm they see _different_ rows, not the same).
   - One user from a _different_ role to confirm denial works (e.g. probe a `paciente` user against a `terapeuta`-only policy).
   - Anonymous: `set local role anon;` then `select count(*) ...; reset role;`.

4. **Print the comparison table** in the chat:

   ```
   Visible rows on public.<table>:

     terapeuta1@clienteapp.test   →  N
     terapeuta2@clienteapp.test   →  M
     paciente1@clienteapp.test    →  K
     anon                      →  Z
   ```

5. **Ask the user:** _"Do these counts match your intent?"_

6. **If yes** — stop and print the exact hand-off:

   ```
   ✅ Local migration applied and probed.
   Migration file: supabase/migrations/<filename>

   When you're ready, push to remote yourself with:
       npm run supabase:push

   This skill does not push to remote.
   ```

7. **If no, or the probe is obviously wrong (e.g. all counts are 0, or a denied role sees rows)** — offer to roll back the local migration and stop without leaving the user in a half-applied state:

   ```
   ⚠ Roll back local? I can run `npx supabase db reset` (or `npx supabase migration down`)
   and delete the migration file. The remote DB is untouched.
   ```

   Roll back only on explicit confirmation. Never delete the migration file silently.

---

## Reference — Supabase RLS helper functions

- `auth.uid()` — id of the user making the request. Always wrap as `(select auth.uid())`.
- `auth.jwt()` — the full JWT. Use to read `app_metadata` (server-controlled) for authorization data; never use `user_metadata` (user-controlled) for authz.
- `auth.role()` — current Postgres role (`anon` / `authenticated` / `service_role`). Rarely needed because `to <role>` clause is preferred for routing.

PostgreSQL roles used by Supabase:

- `anon` — unauthenticated request.
- `authenticated` — logged-in user.
- `service_role` — backend-only, bypasses RLS entirely. Never reference in a policy.

## Reference — Project canonical example

`docs/rls/README.md` documents the style this skill matches:

- snake_case names
- `"public"."<table>"` quoting
- `as permissive` always declared
- one operation per policy
- `to authenticated` for all current policies

Note: older policies used bare `auth.uid()` and `EXISTS` subqueries. This skill emits the perf-optimized form (`(select auth.uid())`, `IN (select ...)`) going forward.
