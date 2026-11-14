---
name: supabase-migration
description: Manages Supabase PostgreSQL database schema declaratively via SQL files in supabase/schemas/, following project SQL style rules. Use when user wants to create a table, add a column, modify a schema, work on declarative schema, define a new database entity, or update a supabase schema.
---

# Supabase Migration

Declarative schema management: write the desired final state in `supabase/schemas/*.sql`; let the CLI diff it into a migration.

## Quick start

### First-time setup (once per project)

1. Create `supabase/schemas/` directory
2. In `supabase/config.toml`, set:
   ```toml
   schema_paths = ["./schemas/*.sql"]
   ```

### Add or change a table

1. Create or edit `supabase/schemas/<NN>_<entity>.sql` (e.g. `01_users.sql`)
2. Write the **desired final state** — full table definition, not ALTER statements
3. Run the migration workflow (see below)

## SQL Style Rules

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  title text not null,
  body text,
  user_id bigint references public.users (id),
  created_at timestamptz not null default now()
);
comment on table public.posts is 'User-created posts in the application.';
```

- `snake_case` for all identifiers; lowercase SQL keywords
- **Plural** table names (`posts`, `users`, `order_items`)
- **Singular** column names (`title`, not `titles`)
- Primary key: always `id bigint generated always as identity primary key`
- Foreign keys: `<singular_table>_id` (e.g. `user_id references public.users (id)`)
- Dates: `timestamptz`, ISO 8601 format
- **Table comment required**, up to 1024 chars
- Always qualify schema in queries: `public.posts`
- New columns: **append to end** to avoid unnecessary diffs

## File Naming Convention

Files run in lexicographic order. Use a two-digit prefix:

```
supabase/schemas/
├── 01_users.sql       # no foreign key deps
├── 02_posts.sql       # references users
└── 03_comments.sql    # references users, posts
```

Parent tables must appear before child tables.

## Migration Workflow

```bash
supabase stop
supabase db diff -f <descriptive_name>   # e.g.: add_posts_table
# review supabase/migrations/<timestamp>_<name>.sql
supabase start
```

Do **not** write to `supabase/migrations/` by hand (except for the caveats below).

## Functions and triggers

Function **bodies** and trigger declarations ARE captured by `supabase db diff` — declare them in `supabase/schemas/` like any table.

**Known migra limitation:** changes to a function's `proconfig` (the `set search_path = ''` clause) and to its `EXECUTE` grants are NOT detected by `db diff`. When you add or change those, write a **manual versioned migration** in `supabase/migrations/` alongside updating the schema file. Verify with `select proname, proconfig from pg_proc where proname = '<fn>'` after applying.

### File placement (4 rules)

1. **Trigger that applies to a single table** → at the end of that table's file (e.g. `set_pacientes_updated_at` lives in `21_pacientes.sql`).
2. **Utility function reused by ≥2 triggers or queries** → `00_functions.sql`.
3. **Trigger against a non-`public` schema** (e.g. `auth.users`) → `99_auth_hooks.sql`.
4. **RPC function called from app code via `supabase.rpc(...)`** → new file with a high prefix that runs after tables but before auth hooks: `70_rpc_<feature>.sql`. Each feature in its own file.

### Mandatory function template

Every new function MUST follow this shape (adapted from Supabase docs — these defaults exist for security reasons):

```sql
create or replace function public.<verb>_<object>(<typed_args>)
returns <explicit_type>
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- always use fully qualified names: public.table_name
  ...
end;
$$;

comment on function public.<verb>_<object> is '<one-line purpose>';
```

Rules:

- **`security invoker` by default.** Use `security definer` ONLY when the function must cross schema boundaries with elevated permissions (e.g. trigger on `auth.users` writing to `public.profiles`). When you use DEFINER, `set search_path = ''` is non-negotiable — without it, an attacker who controls `search_path` can hijack object resolution.
- **`set search_path = ''` always.** Even for INVOKER. Inside the body, reference every object fully qualified: `public.pacientes`, `public.set_updated_at`, etc.
- **Explicit return type and explicit parameter types.** No `anyelement` shortcuts unless genuinely necessary.
- **Default volatility correctly.** Mark pure computations `immutable`, read-only queries `stable`, anything that writes or has side effects `volatile` (default). PostgreSQL uses these for query optimization.
- **Comment on every function.** `comment on function public.<name> is '...'` — required, same as tables.

### Naming

- Functions: `snake_case`, leading verb. Examples: `set_updated_at`, `handle_new_user`, `calculate_total_price`, `recalcular_nivel_paciente`.
- Triggers: `<verb>_<table>_<event>`. Examples: `set_pacientes_updated_at`, `on_auth_user_created`.

### Trigger pattern

```sql
create trigger set_<table>_updated_at
before update on public.<table>
for each row execute function public.set_updated_at();
```

### Testing

Functions are not unit-tested in SQL. The project's `/tdd` mandate covers `.ts`, not `.sql`. Coverage strategy:

- **Triggers (`updated_at`-style)**: implicitly verified by the table's integration usage.
- **RPC functions with business logic**: tested through the entity hook in `app/controllers/[Entity]/api/use<Action>.ts` that consumes them. The hook is `.ts`, so it falls under `/tdd` and the function's branches are covered from the outside.
- Pure-SQL business logic without a TS consumer is out of scope today. If it appears, evaluate adding pgTAP at that point.

### When DEFINER is the right call (project example)

`public.handle_new_user` is a trigger on `auth.users` that inserts into `public.profiles`. INVOKER would run with the anon role's perms and fail. DEFINER + `set search_path = ''` + fully qualified `public.profiles` is the correct pattern.

## Caveats: Use Versioned Migrations Instead

These are NOT captured by schema diff — create them manually in `supabase/migrations/`:

- DML: `INSERT`, `UPDATE`, `DELETE`
- RLS policies and `alter policy`
- View ownership, grants, `security invoker` on views
- Materialized views
- Table partitions and publications (`alter publication ... add table`)
- Schema privileges and column privileges
- `comment on ...` standalone statements
- `create domain` statements

## Rollback

1. Edit `supabase/schemas/<file>.sql` to the desired state
2. Run `supabase stop && supabase db diff -f <rollback_name>`
3. Review the generated migration carefully before applying

See [REFERENCE.md](REFERENCE.md) for extended examples and full style guide.
