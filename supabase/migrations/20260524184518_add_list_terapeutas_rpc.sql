set check_function_bodies = off;

create or replace function public.list_terapeutas()
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int
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
    select t.id,
           coalesce(p.nombre, '')                                                  as nombre,
           coalesce(u.email::text, '')                                             as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                          as estado,
           coalesce(
             count(ap.*) filter (where ap.fecha_hasta is null)
           , 0)::int                                                               as pacientes_activos
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join public.asignaciones_paciente ap on ap.terapeuta_id = t.id
     group by t.id, p.nombre, u.email, t.telefono, e.codigo;
end;
$$;

comment on function public.list_terapeutas is
  'Lista todos los terapeutas con email (de auth.users), teléfono, estado (codigo) y conteo de pacientes activos. Guarda is_admin(). Set returning.';

grant execute on function public.list_terapeutas() to authenticated;
