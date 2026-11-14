-- baja-voluntaria-cuenta-paciente, Fase 1 (DB Foundational): seeds the
-- 'baja_voluntaria' row on public.estados_paciente.
--
-- DML is not captured by `supabase db diff` (see supabase-migration skill
-- caveats) — hand-authored, mirroring the precedent at
-- 20260719120000_seed_reference_lookups.sql:30-33 exactly: literal UUID,
-- `on conflict (codigo) do nothing`. The UUID continues the a3000001/a3000002
-- sequence of that same catalog. Must be a literal because supabase/seed.sql
-- references these catalog UUIDs as literal FK values.
--
-- Mirrored (idempotent) in supabase/schemas/03_estados_paciente.sql as
-- documentation of the desired declarative state.

insert into public.estados_paciente (id, codigo, nombre, descripcion) values
  ('a3000003-0000-0000-0000-000000000000', 'baja_voluntaria', 'Baja voluntaria',
   'El paciente eliminó su propia cuenta desde la app; la ficha clínica se conserva')
on conflict (codigo) do nothing;

-- El comment de la tabla también se actualizó en el archivo declarativo, pero
-- `db diff` está roto en este repo (ver header de la migración siguiente), así
-- que se aplica acá a mano para que la base refleje el schema.
comment on table public.estados_paciente is 'Catálogo de estados operacionales del paciente (activo, pausado, baja_voluntaria).';
