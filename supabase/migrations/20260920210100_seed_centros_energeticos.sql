-- Mirrors the insert block in supabase/schemas/45_centros_energeticos.sql.
-- Separate from M1 (20260920210000_mediciones_estructura_fundacion.sql) on
-- purpose: DML is never diff-captured (.claude/supabase-declarative-database-schema.md
-- "Known caveats"), which makes this migration's hand-maintained status
-- obvious, and gives the design §14 rollback ("tables and data are never
-- dropped") a single file to point at.
--
-- Orden: Corona · Frente · Tercer Ojo · Hombros · Brazos · Garganta ·
-- Cardíaco · Plexo Solar · Sacro · Raíz · Piernas · Columna (catálogo de ejemplo). etiqueta_paciente = nombre (OD-4,
-- abierta). Idempotente: on conflict (codigo) do nothing.
--
-- sdd/medir-chakras PR1 (E0: Database & Security Foundation), design §2 M2.

insert into public.centros_energeticos (codigo, nombre, etiqueta_paciente, orden) values
  ('corona',             'Corona',              'Corona',              1),
  ('frente',             'Frente',              'Frente',             2),
  ('tercer_ojo',         'Tercer Ojo',          'Tercer Ojo',             3),
  ('hombros',            'Hombros',             'Hombros',         4),
  ('brazos',             'Brazos',              'Brazos',       5),
  ('garganta',           'Garganta',            'Garganta',            6),
  ('cardiaco',           'Cardíaco',            'Cardíaco',            7),
  ('plexo_solar',        'Plexo Solar',         'Plexo Solar',         8),
  ('sacro',              'Sacro',               'Sacro',              9),
  ('raiz',               'Raíz',                'Raíz',           10),
  ('piernas',            'Piernas',             'Piernas',  11),
  ('columna',            'Columna',             'Columna', 12)
on conflict (codigo) do nothing;
