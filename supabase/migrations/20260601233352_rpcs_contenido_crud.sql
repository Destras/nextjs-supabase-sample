

drop function if exists "public"."deactivate_terapeuta"(p_terapeuta_id uuid, p_motivo text);

drop function if exists "public"."reactivate_terapeuta"(p_terapeuta_id uuid);

CREATE UNIQUE INDEX pacientes_user_id_key ON public.pacientes USING btree (user_id) WHERE (user_id IS NOT NULL);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_contenido(p_tipo text, p_titulo text, p_descripcion text)
 RETURNS TABLE(id uuid, tipo text, titulo text, descripcion text, recurso_ref text, duracion_seg integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  return query
    insert into public.contenidos (tipo, titulo, descripcion, recurso_ref, activo)
    values (p_tipo, btrim(p_titulo), p_descripcion, null, true)
    returning
      contenidos.id,
      contenidos.tipo,
      contenidos.titulo,
      contenidos.descripcion,
      contenidos.recurso_ref,
      contenidos.duracion_seg;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_frase(p_titulo text, p_descripcion text, p_texto text)
 RETURNS TABLE(id uuid, titulo text, descripcion text, texto text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_texto is null or btrim(p_texto) = '' then
    raise exception 'texto_vacio' using errcode = '23514';
  end if;

  return query
    insert into public.frases_motivacionales (causa_id, titulo, descripcion, texto, activo)
    values (null, p_titulo, p_descripcion, btrim(p_texto), true)
    returning
      frases_motivacionales.id,
      frases_motivacionales.titulo,
      frases_motivacionales.descripcion,
      frases_motivacionales.texto;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_contenido(p_id uuid, p_titulo text, p_descripcion text)
 RETURNS TABLE(id uuid, tipo text, titulo text, descripcion text, recurso_ref text, duracion_seg integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_vacio' using errcode = '23514';
  end if;

  return query
    update public.contenidos as c
       set titulo      = btrim(p_titulo),
           descripcion = p_descripcion
     where c.id = p_id
    returning
      c.id,
      c.tipo,
      c.titulo,
      c.descripcion,
      c.recurso_ref,
      c.duracion_seg;

  if not found then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_frase(p_id uuid, p_titulo text, p_descripcion text, p_texto text)
 RETURNS TABLE(id uuid, titulo text, descripcion text, texto text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_texto is null or btrim(p_texto) = '' then
    raise exception 'texto_vacio' using errcode = '23514';
  end if;

  return query
    update public.frases_motivacionales as f
       set titulo      = p_titulo,
           descripcion = p_descripcion,
           texto       = btrim(p_texto)
     where f.id = p_id
    returning
      f.id,
      f.titulo,
      f.descripcion,
      f.texto;

  if not found then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
end;
$function$
;
