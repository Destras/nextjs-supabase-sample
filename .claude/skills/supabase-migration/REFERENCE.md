# Supabase Migration — Reference

## SQL Style Guide

### Naming conventions

| Object      | Convention             | Example                                              |
| ----------- | ---------------------- | ---------------------------------------------------- |
| Tables      | plural, snake_case     | `order_items`                                        |
| Columns     | singular, snake_case   | `user_id`, `created_at`                              |
| Primary key | always `id`            | `id bigint generated always as identity primary key` |
| Foreign key | `<singular_table>_id`  | `post_id references public.posts (id)`               |
| Indexes     | `<table>_<column>_idx` | `users_email_idx`                                    |
| Functions   | verb_noun              | `get_user_posts`                                     |

- No `tbl_` prefix
- Max 63 characters per identifier
- No SQL reserved words as identifiers

### Full table example

```sql
create table public.users (
  id bigint generated always as identity primary key,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.users is 'Registered users of the application.';
```

### Indexes

```sql
create index users_email_idx on public.users (email);
create unique index users_email_unique_idx on public.users (email);
```

### Functions

```sql
create or replace function public.get_post_count(p_user_id bigint)
returns bigint language sql stable as $$
  select count(*) from public.posts where user_id = p_user_id;
$$;
comment on function public.get_post_count(bigint) is 'Returns post count for a user.';
```

### Views (simple only — see caveats for ownership)

```sql
create or replace view public.published_posts as
  select
    posts.id,
    posts.title,
    posts.published_at,
    users.full_name as author_name
  from public.posts
    join public.users on posts.user_id = users.id
  where posts.published_at is not null;
comment on view public.published_posts is 'Published posts with author info.';
```

## Caveats — Full Examples

### DML (seed data)

```sql
-- supabase/migrations/20240101000000_seed_categories.sql
insert into public.categories (name) values ('Technology'), ('Design');
```

### RLS policies

```sql
-- supabase/migrations/20240101000001_rls_posts.sql
alter table public.posts enable row level security;

create policy "Users can view their own posts"
  on public.posts for select
  using (auth.uid()::text = user_id::text);
```

### View ownership / grants

```sql
-- supabase/migrations/20240101000002_view_grants.sql
alter view public.published_posts owner to authenticated;
grant select on public.published_posts to anon;
```

### Materialized views

```sql
-- Must go in migrations
create materialized view public.post_counts as
  select user_id, count(*) as total
  from public.posts group by user_id;
```

### Publications (Realtime)

```sql
alter publication supabase_realtime add table public.posts;
```

### Schema privileges

```sql
grant usage on schema public to anon, authenticated;
```

## config.toml Reference

```toml
[db.migrations]
enabled = true
schema_paths = ["./schemas/*.sql"]
```

The glob is relative to the `supabase/` directory. Files execute in lexicographic order.
