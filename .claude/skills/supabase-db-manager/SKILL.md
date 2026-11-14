---
name: supabase-db-manager
description: Interactive Supabase database schema manager. Accepts schema changes in natural language or pseudo-code, inspects the live database via Supabase MCP, performs a safety analysis, generates declarative schema changes and migrations, and pushes to the remote database only on explicit user confirmation. Use when the user wants to add tables, add/remove/modify columns, define new entities, or manage the database schema with guided safety checks.
---

# Supabase Database Manager

Guided, safety-first workflow for Supabase schema changes. Combines declarative schema management (`supabase/schemas/`) with live database inspection via the Supabase MCP to prevent dangerous operations and data loss.

## The 5-Phase Workflow

---

### Phase 1 — Capture requirements

If the change was not described inline, ask:

- What tables or columns need to be added, modified, or removed?
- Any constraints, indexes, or foreign keys?
- New entity or a change to an existing table?

Accept any format: natural language, pseudo-code, ERD descriptions, partial SQL.

---

### Phase 2 — Inspect current state (run in parallel)

**A. Read local schema files**

Read every file in `supabase/schemas/` to understand the declared schema state.

**B. Inspect live database via Supabase MCP**

First load the Supabase MCP tools:

```
ToolSearch: "supabase execute sql list tables"
```

Then execute these SQL queries against the live database:

```sql
-- All user tables with their columns
select
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.tables t
join information_schema.columns c
  on t.table_name = c.table_name
  and t.table_schema = c.table_schema
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
order by t.table_name, c.ordinal_position;
```

```sql
-- Row counts for all public tables (needed for safety analysis)
select schemaname, tablename, n_live_tup as row_count
from pg_stat_user_tables
where schemaname = 'public';
```

Note any divergence between the local schema files and the live database.

---

### Phase 3 — Plan schema changes

Translate the user's request into SQL following the project's style rules:

- Write the **desired final state** (not ALTER statements)
- `snake_case` identifiers, lowercase SQL keywords
- **Plural** table names (`posts`, `users`, `order_items`)
- **Singular** column names (`title`, `user_id`)
- PK: `id bigint generated always as identity primary key`
- FK: `<singular_table>_id bigint references public.<table> (id)`
- Timestamps: `timestamptz not null default now()`
- `comment on table public.X is '...';` — **required on every table**
- New columns always appended to the end of the table definition

Determine which files to create or update. Files are named with a two-digit prefix in dependency order (parent tables first):

```
supabase/schemas/
├── 01_users.sql       # no FK deps
├── 02_posts.sql       # references users
└── 03_comments.sql    # references users, posts
```

See @.claude/skills/supabase-db-manager/REFERENCE.md for full SQL examples.

---

### Phase 4 — Safety analysis

For every proposed change, classify it using this table:

| Classification | Examples                                                                                                                                | Action                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **SAFE**       | New table, nullable new column, column with DEFAULT, new index                                                                          | Proceed automatically             |
| **RISKY**      | NOT NULL without DEFAULT on empty table, compatible type cast (e.g. int→bigint)                                                         | Warn — user confirms to proceed   |
| **DANGEROUS**  | Drop table with rows, drop column with data, NOT NULL without DEFAULT on non-empty table, incompatible type change, rename table/column | Block — present safe alternatives |

For each **DANGEROUS** change, present numbered alternatives and ask the user to choose:

| Dangerous operation                             | Alternatives                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| DROP TABLE with rows                            | (a) Add `deleted_at timestamptz` soft-delete column; (b) Export data first, then drop                |
| DROP COLUMN with data                           | (a) Set nullable and deprecate in code; (b) Migrate data to another column first                     |
| ADD NOT NULL without DEFAULT on populated table | (a) Add column with temporary DEFAULT, backfill, remove default constraint; (b) Keep column nullable |
| Incompatible type change                        | (a) Add new column with correct type, migrate data, drop old column; (b) Keep existing type          |
| RENAME table or column                          | (a) Add new name, migrate code references, deprecate old; (b) Create a view as alias                 |

After the user selects an alternative, update the proposed SQL accordingly before proceeding to Phase 5.

---

### Phase 5 — Summary, confirmation, and execution

Present this summary to the user:

```
## Schema Changes Summary

### New tables
[list or "none"]

### Modified tables
[table name]
  - Added columns: [list]
  - Removed columns: [list — flag any with data]

### Safety assessment: SAFE | RISKY | DANGEROUS
[Risk details if applicable]

### Implications
[Plain English: what app code needs updating, performance impacts,
 data loss risks, RLS policies to add manually, etc.]
```

**Wait for explicit user confirmation before writing any files.**

If the user confirms:

1. Write or update the `supabase/schemas/*.sql` files (final desired state only — no ALTER statements)

2. Stop the local Supabase instance and generate the migration:

   ```bash
   npx supabase stop
   npx supabase db diff -f <descriptive_migration_name>
   ```

   Use a snake_case migration name that describes the change (e.g., `add_posts_table`, `add_bio_to_users`).

3. Read and display the generated migration file from `supabase/migrations/` so the user can review it.

4. Ask: **"Push these migrations to the remote database now?"**

5. If the user confirms: run `npm run supabase:push`

---

## Caveats — Manual migrations required for

These changes are **not** captured by `supabase db diff`. Create them manually in `supabase/migrations/` with a `YYYYMMDDHHMMSS_<name>.sql` filename:

- DML: `INSERT`, `UPDATE`, `DELETE`
- RLS policies and `alter policy`
- View ownership, grants, `security invoker` on views
- Materialized views
- Table partitions and publications (`alter publication ... add table`)
- Schema privileges and column privileges
- `comment on ...` standalone statements
- `create domain` statements

Flag these to the user in the summary if the requested change requires any of them.

---

## Reference

See @.claude/skills/supabase-db-manager/REFERENCE.md for extended SQL examples, full safety alternatives catalog, and MCP introspection queries.
