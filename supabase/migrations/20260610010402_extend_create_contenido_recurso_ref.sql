-- Drop the old 3-argument signature first.
-- Postgres identifies functions by their full signature (name + arg types),
-- so create or replace on a different arg list would create an overload instead
-- of replacing the existing function.
drop function if exists public.create_contenido(text, text, text);

set check_function_bodies = off;

create or replace function public.create_contenido(
  p_tipo         text,
  p_titulo       text,
  p_descripcion  text,
  p_recurso_ref  text,
  p_duracion_seg integer
)
returns table(
  id           uuid,
  tipo         text,
  titulo       text,
  descripcion  text,
  recurso_ref  text,
  duracion_seg integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_tipo not in ('video', 'audio') then
    raise exception 'tipo_invalido' using errcode = '23514';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_vacio' using errcode = '23514';
  end if;

  if p_recurso_ref is null or btrim(p_recurso_ref) = '' then
    raise exception 'recurso_ref_vacio' using errcode = '23514';
  end if;

  return query
    insert into public.contenidos (tipo, titulo, descripcion, recurso_ref, duracion_seg, activo)
    values (p_tipo, btrim(p_titulo), p_descripcion, btrim(p_recurso_ref), p_duracion_seg, true)
    returning
      contenidos.id,
      contenidos.tipo,
      contenidos.titulo,
      contenidos.descripcion,
      contenidos.recurso_ref,
      contenidos.duracion_seg;
end;
$$;

-- comment on and grant are not captured by supabase db diff (known migra caveats);
-- they are added manually here alongside the schema file update.
comment on function public.create_contenido(text, text, text, text, integer) is
  'Inserta un nuevo contenido (video/audio) persistiendo recurso_ref y duracion_seg. Valida is_admin(), tipo válido, título no vacío y recurso_ref no vacío. p_duracion_seg es nullable (se acepta null cuando el navegador no expone la duración). Set-returning: devuelve la fila creada para que el hook la mapee.';

grant execute on function public.create_contenido(text, text, text, text, integer) to authenticated;
