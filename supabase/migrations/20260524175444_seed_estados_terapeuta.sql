-- seed de catálogo de estados_terapeuta
-- DEC-7: idempotente vía on conflict do nothing
insert into public.estados_terapeuta (codigo, nombre)
values
  ('pendiente', 'Pendiente'),
  ('activo',    'Activo'),
  ('inactivo',  'Inactivo')
on conflict (codigo) do nothing;
