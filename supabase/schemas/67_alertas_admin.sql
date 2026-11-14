-- ---------------------------------------------------------------------------
-- list_alertas_admin
-- ---------------------------------------------------------------------------
-- Alertas activas de la red, scoped por rol admin. Filtra
-- derive_alertas_activas() opcionalmente por terapeuta_id — el drill-down del
-- admin (Task 2.3) invoca con el terapeuta_id de la fila de list_terapeutas;
-- p_terapeuta_id null devuelve la red completa (soportado, pero la UI del MVP
-- no lo usa todavía). Guard: is_admin(), a diferencia de
-- list_alertas_terapeuta cuyo scoping es el propio enforcement.
create or replace function public.list_alertas_admin(p_terapeuta_id uuid default null)
returns table (
  paciente_id      uuid,
  paciente_nombre  text,
  terapeuta_id     uuid,
  terapeuta_nombre text,
  tipo             text,
  evento_ref       text,
  valor            int,
  fecha            timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select d.paciente_id,
           d.paciente_nombre,
           d.terapeuta_id,
           d.terapeuta_nombre,
           d.tipo,
           d.evento_ref,
           d.valor,
           d.fecha
      from public.derive_alertas_activas() d
     where p_terapeuta_id is null or d.terapeuta_id = p_terapeuta_id;
end;
$$;

comment on function public.list_alertas_admin(uuid) is
  'Alertas activas de la red (admin). Guarda is_admin(). p_terapeuta_id filtra por terapeuta (usado por el drill-down de Task 2.3); null devuelve toda la red (soportado, sin uso en la UI del MVP). Devuelve las 8 columnas del motor derive_alertas_activas().';

grant execute on function public.list_alertas_admin(uuid) to authenticated;
