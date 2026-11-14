-- ---------------------------------------------------------------------------
-- create_contenido
-- ---------------------------------------------------------------------------

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

  if p_tipo not in ('video', 'audio', 'egregor', 'cma', 'ic') then
    raise exception 'tipo_invalido' using errcode = '23514';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_vacio' using errcode = '23514';
  end if;

  -- Guard sin excepción por tipo, a propósito: las filas cma/ic se crean
  -- exclusivamente via create_contenido_galeria, que es atómica sobre
  -- contenidos + contenido_imagenes en una sola transacción (design §3
  -- ADR-3). Este guard es lo que hace estructuralmente imposible una
  -- galería con cero imágenes a través de create_contenido — eximir cma/ic
  -- acá permitiría insertar un contenidos con tipo='cma' y ninguna fila en
  -- contenido_imagenes, asignable igual a un slot del plan (el guard tipo-
  -- por-orden de set_entregas_plan solo compara c.tipo, no exige imágenes) y
  -- expuesta al paciente como un carrusel vacío sin error en ningún punto.
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

comment on function public.create_contenido(text, text, text, text, integer) is
  'Inserta un nuevo contenido (video/audio/egregor/cma/ic) persistiendo recurso_ref y duracion_seg. Valida is_admin(), tipo válido (5 valores), título no vacío y recurso_ref no vacío para TODOS los tipos, sin excepción. cma/ic NO se crean vía este RPC: create_contenido_galeria es el único flujo para galerías (atómico sobre contenidos + contenido_imagenes); este guard sin excepción es lo que hace estructuralmente imposible una galería con cero imágenes. p_duracion_seg es nullable (se acepta null cuando el navegador no expone la duración). Set-returning: devuelve la fila creada para que el hook la mapee.';

grant execute on function public.create_contenido(text, text, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- create_contenido_galeria
-- ---------------------------------------------------------------------------
-- Flujo real de creación de galerías (cma/ic) desde el console: una sola
-- transacción crea la fila contenidos (recurso_ref/duracion_seg null) y sus
-- contenido_imagenes, en orden de subida. `orden` es server-derivado vía
-- `with ordinality` — el cliente nunca lo envía, así no puede dejar un hueco
-- (item fallido descartado) ni colisionar con unique(contenido_id, orden).
-- Atómico a propósito (design §3 ADR-3): branch create_contenido + un segundo
-- call de attach dejaría una galería con cero imágenes si el segundo call
-- falla, y un terapeuta podría igual asignarla a un plan.

create or replace function public.create_contenido_galeria(
  p_tipo        text,
  p_titulo      text,
  p_descripcion text,
  p_paths       text[]
)
returns table(
  id          uuid,
  tipo        text,
  titulo      text,
  descripcion text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_tipo not in ('cma', 'ic') then
    raise exception 'tipo_invalido' using errcode = '23514';
  end if;

  if p_titulo is null or btrim(p_titulo) = '' then
    raise exception 'titulo_vacio' using errcode = '23514';
  end if;

  if p_paths is null or array_length(p_paths, 1) is null then
    raise exception 'galeria_vacia' using errcode = '23514';
  end if;

  insert into public.contenidos (tipo, titulo, descripcion, recurso_ref, duracion_seg, activo)
  values (p_tipo, btrim(p_titulo), p_descripcion, null, null, true)
  returning contenidos.id into v_id;

  insert into public.contenido_imagenes (contenido_id, path, orden)
  select v_id, p.path, p.ord
    from unnest(p_paths) with ordinality as p(path, ord);

  return query
    select
      c.id,
      c.tipo,
      c.titulo,
      c.descripcion
      from public.contenidos as c
     where c.id = v_id;
end;
$$;

comment on function public.create_contenido_galeria(text, text, text, text[]) is
  'Crea una galería (cma/ic) en una sola transacción: inserta la fila contenidos (recurso_ref/duracion_seg null) y sus contenido_imagenes en orden de subida (with ordinality — el cliente nunca envía orden). Valida is_admin(), tipo in (cma, ic), título no vacío y p_paths no vacío. Atómico a propósito (design §3 ADR-3): evita una galería con cero imágenes ante un fallo entre dos round-trips.';

grant execute on function public.create_contenido_galeria(text, text, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- set_contenido_imagenes
-- ---------------------------------------------------------------------------
-- Full-replace de las imágenes de una galería existente (cma/ic), mirroring
-- set_entregas_plan: borra las que ya no están en p_paths, re-inserta el
-- resto con upsert sobre (contenido_id, orden) y devuelve los paths huérfanos
-- para que el cliente haga la purga best-effort en Storage (design §3.1).
-- Sin este RPC una galería es inmutable una vez creada, y delete_contenido
-- rechaza en_uso para una asignada — una galería con una imagen equivocada
-- quedaría permanentemente mal.

create or replace function public.set_contenido_imagenes(
  p_contenido_id uuid,
  p_paths        text[]
)
returns table(removed_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_paths is null or array_length(p_paths, 1) is null then
    raise exception 'galeria_vacia' using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.contenidos as c
     where c.id = p_contenido_id
       and c.tipo in ('cma', 'ic')
  ) then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  return query
    with deleted as (
      delete from public.contenido_imagenes as ci
       where ci.contenido_id = p_contenido_id
         and ci.path <> all (p_paths)
      returning ci.path
    ),
    upserted as (
      insert into public.contenido_imagenes (contenido_id, path, orden)
      select p_contenido_id, p.path, p.ord
        from unnest(p_paths) with ordinality as p(path, ord)
      on conflict (contenido_id, orden) do update
        set path = excluded.path
      returning contenido_imagenes.contenido_id
    )
    select deleted.path from deleted;
end;
$$;

comment on function public.set_contenido_imagenes(uuid, text[]) is
  'Full-replace de las contenido_imagenes de una galería (cma/ic): borra las filas cuyo path ya no está en p_paths, re-inserta el resto con upsert sobre (contenido_id, orden) y devuelve los paths borrados (removed_path) para que el cliente purgue Storage best-effort. Valida is_admin(), p_paths no vacío y que el contenido exista y sea tipo cma/ic (no_encontrado si no).';

grant execute on function public.set_contenido_imagenes(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- update_contenido
-- ---------------------------------------------------------------------------

create or replace function public.update_contenido(
  p_id          uuid,
  p_titulo      text,
  p_descripcion text
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
$$;

comment on function public.update_contenido(uuid, text, text) is
  'Actualiza título y descripción de un contenido. No modifica tipo ni recurso_ref. Valida is_admin() y título no vacío. Lanza no_encontrado si el id no existe. Set-returning: devuelve la fila actualizada.';

grant execute on function public.update_contenido(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- count_contenido_usage
-- ---------------------------------------------------------------------------

create or replace function public.count_contenido_usage(p_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select count(distinct e.paciente_id) into v_count
    from public.entregas_plan  ep
    join public.etapas_tratamiento e on e.id = ep.etapa_id
   where ep.contenido_id = p_id;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.count_contenido_usage(uuid) is
  'Cuenta los pacientes distintos que tienen el contenido asignado en su plan real (entregas_plan → etapas_tratamiento). Valida is_admin(). Devuelve 0 si no está en uso.';

grant execute on function public.count_contenido_usage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_contenido
-- ---------------------------------------------------------------------------

create or replace function public.delete_contenido(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   integer;
  v_deleted integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  v_count := public.count_contenido_usage(p_id);

  if v_count > 0 then
    raise exception 'en_uso' using errcode = 'P0001';
  end if;

  delete from public.contenidos where id = p_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.delete_contenido(uuid) is
  'Borra físicamente un contenido. Lanza en_uso (P0001) si está asignado a pacientes; no_encontrado (P0002) si el id no existe. Valida is_admin().';

grant execute on function public.delete_contenido(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- replace_and_delete_contenido
-- ---------------------------------------------------------------------------

create or replace function public.replace_and_delete_contenido(p_old_id uuid, p_new_id uuid)
returns table(affected integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_tipo  text;
  v_new_tipo  text;
  v_affected  integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- Validate old contenido exists and capture tipo
  select c.tipo into v_old_tipo
    from public.contenidos c
   where c.id = p_old_id;

  if not found then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  -- Validate new contenido exists and capture tipo
  select c.tipo into v_new_tipo
    from public.contenidos c
   where c.id = p_new_id;

  if not found then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  -- Validate tipos match
  if v_old_tipo <> v_new_tipo then
    raise exception 'tipo_distinto' using errcode = 'P0003';
  end if;

  -- Capture affected count before the swap (same as count_contenido_usage)
  select count(distinct e.paciente_id) into v_affected
    from public.entregas_plan  ep
    join public.etapas_tratamiento e on e.id = ep.etapa_id
   where ep.contenido_id = p_old_id;

  v_affected := coalesce(v_affected, 0);

  -- Atomic swap: update references then delete original
  update public.entregas_plan
     set contenido_id = p_new_id
   where contenido_id = p_old_id;

  delete from public.contenidos
   where id = p_old_id;

  return query select v_affected;
end;
$$;

comment on function public.replace_and_delete_contenido(uuid, uuid) is
  'Remplaza todas las referencias de un contenido en entregas_plan por otro del mismo tipo y borra el original en una sola transacción. Lanza tipo_distinto si los tipos no coinciden, no_encontrado si algún id no existe. Devuelve el número de pacientes afectados. Valida is_admin().';

grant execute on function public.replace_and_delete_contenido(uuid, uuid) to authenticated;
