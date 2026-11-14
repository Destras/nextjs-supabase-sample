# Supabase DB Manager — Reference

## Full table example

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  title text not null,
  body text,
  user_id bigint references public.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.posts is 'User-created posts in the application.';
```

## Indexes

```sql
create index posts_user_id_idx on public.posts (user_id);
create unique index users_email_unique_idx on public.users (email);
```

## Foreign key conventions

| Scenario                         | Example                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| Column referencing `users`       | `user_id bigint references public.users (id)`                     |
| Column referencing `order_items` | `order_item_id bigint references public.order_items (id)`         |
| Nullable FK                      | `author_id bigint references public.users (id)` (omit `not null`) |

---

## Safety Alternatives — Extended Catalog

### DROP TABLE with rows

Option (a) — Soft delete (preferred for production data):

```sql
-- Instead of dropping, add a deleted_at column
alter table public.posts add column deleted_at timestamptz;
```

Filter deleted records in queries: `where deleted_at is null`.

Option (b) — Export first:
Run `select * from public.<table>` via MCP, save the data, then proceed with the drop.

---

### DROP COLUMN with data

Option (a) — Deprecate in place:

```sql
-- Mark nullable so the application can stop writing to it
-- Remove the column in a future migration once all code references are gone
```

Option (b) — Migrate data to another column, then drop the old one:

```sql
-- In a manual migration file (not schema diff):
update public.posts set new_col = old_col where old_col is not null;
```

Then remove the old column from the schema file and re-diff.

---

### ADD NOT NULL column on populated table

Option (a) — Add with temporary DEFAULT, backfill, then tighten:

Step 1 — schema file adds column with DEFAULT:

```sql
description text not null default ''
```

Step 2 — manual migration backfills real values:

```sql
-- supabase/migrations/<timestamp>_backfill_description.sql
update public.posts set description = title where description = '';
```

Step 3 — after backfill is applied, update schema to remove the default:

```sql
description text not null
```

Option (b) — Keep nullable, enforce at application layer.

---

### Incompatible type change

Option (a) — New column approach:

```sql
-- Step 1: add new column
email_address text

-- Step 2: manual migration to copy data
update public.users set email_address = email::text;

-- Step 3: remove old column from schema file, rename new column
```

Option (b) — Keep current type; cast at query time in application code.

---

### RENAME table or column

Option (a) — Add-migrate-deprecate:

```sql
-- Step 1: add new column in schema file
full_name text  -- renamed from name

-- Step 2: manual migration
update public.users set full_name = name;

-- Step 3: remove old column from schema, update all code references
```

Option (b) — View alias (non-breaking):

```sql
-- Manual migration only (views not captured by diff):
create or replace view public.users_v2 as
  select *, name as full_name from public.users;
```

---

## MCP Introspection Queries

### All tables and columns

```sql
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

### Row counts

```sql
select schemaname, tablename, n_live_tup as row_count
from pg_stat_user_tables
where schemaname = 'public';
```

### Foreign key constraints

```sql
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table,
  ccu.column_name as foreign_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public';
```

### Indexes

```sql
select
  indexname,
  tablename,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### Applied migrations

```sql
select version, name, executed_at
from supabase_migrations.schema_migrations
order by executed_at desc
limit 20;
```

---

## Migration workflow commands

```bash
# Stop local Supabase before diffing
npx supabase stop

# Generate migration from schema diff
npx supabase db diff -f <descriptive_name>
# e.g.: add_posts_table | add_bio_to_users | add_orders_and_items

# Review the generated file
# supabase/migrations/<timestamp>_<name>.sql

# Start Supabase again locally
npx supabase start

# Push migrations to remote database
npm run supabase:push
```

---

## File naming convention

Schema files run in lexicographic order. Use two-digit prefixes; parent tables first:

```
supabase/schemas/
├── 01_users.sql          # no FK deps
├── 02_posts.sql          # references users
├── 03_comments.sql       # references users and posts
└── 04_order_items.sql    # references orders (if 04_orders.sql existed)
```

---

## Operations NOT captured by supabase db diff

Create these manually in `supabase/migrations/<timestamp>_<name>.sql`:

| Operation                                      | Why manual           |
| ---------------------------------------------- | -------------------- |
| `INSERT / UPDATE / DELETE`                     | DML is not schema    |
| RLS policies (`create policy`, `alter policy`) | Not tracked by migra |
| View ownership and grants                      | Not tracked          |
| `security invoker` on views                    | Not tracked          |
| Materialized views                             | Not tracked          |
| Table partitions                               | Not tracked          |
| `alter publication ... add table`              | Not tracked          |
| Schema/column privileges                       | Not tracked          |
| `comment on ...` standalone                    | Not tracked          |
| `create domain`                                | Ignored by migra     |
