-- ---------------------------------------------------------------------------
-- contenido_imagenes
-- ---------------------------------------------------------------------------
-- Child table of `contenidos` holding the ordered image set of a gallery
-- (tipo cma / ic). `contenidos.recurso_ref` stays null for these tipos; this
-- table is the only place a gallery path exists.
--
-- File placement (ADR-1, design §1.2): numbered 26_, NOT the "natural" 15_
-- slot right after its parent (10_contenidos.sql) — that numeric slot was
-- later taken by 15_identity_functions.sql (fix/schema-load-order). Its RLS
-- policy below calls public.is_console_user(), now defined in
-- 15_identity_functions.sql — well before this file, so no ordering issue
-- remains. Historically this repo's db diff was broken by exactly this
-- pattern (a helper referenced before its definition); see
-- 15_identity_functions.sql and 30_has_active_assignment.sql for the fix.
-- 26_ still clears the FK dependency on 10_contenidos.sql.
--
-- `id uuid default gen_random_uuid()` is a deliberate deviation from the
-- generic supabase-migration skill (`bigint generated always as identity`):
-- matches its parent `contenidos` (10_contenidos.sql:2) and sibling
-- `entregas_plan` (43_entregas_plan.sql:2). No `updated_at`, no trigger: rows
-- are immutable, every mutation is a full-replace (set_contenido_imagenes),
-- mirroring set_entregas_plan.
--
-- `unique (contenido_id, orden)` enforces one image per slot per gallery and
-- supplies the index get_mi_plan_semanal's per-pieza subquery probes.
-- ---------------------------------------------------------------------------

create table public.contenido_imagenes (
  id           uuid        not null default gen_random_uuid() primary key,
  contenido_id uuid        not null references public.contenidos (id) on delete cascade,
  path         text        not null,
  orden        integer     not null,
  created_at   timestamptz not null default now(),
  unique (contenido_id, orden)
);

comment on table public.contenido_imagenes is 'Imágenes ordenadas de un contenido tipo galería (cma / ic). Un contenido de video/audio/egregor nunca tiene filas acá.';

alter table public.contenido_imagenes enable row level security;

-- No insert/update/delete policy: every write goes through a security
-- definer RPC (create_contenido_galeria, set_contenido_imagenes), exactly as
-- entregas_plan does (43_entregas_plan.sql declares select-only policies).

-- paciente_puede_ver_objeto (SEG-002) busca la imagen por la ruta del objeto.
create index contenido_imagenes_path_idx
  on public.contenido_imagenes using btree (path);
