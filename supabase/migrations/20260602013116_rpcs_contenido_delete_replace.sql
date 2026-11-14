set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.count_contenido_usage(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.count_frase_usage(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select count(distinct e.paciente_id) into v_count
    from public.etapas_tratamiento e
   where e.frase_motivacional_id = p_id;

  return coalesce(v_count, 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_contenido(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_frase(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_count   integer;
  v_deleted integer;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  v_count := public.count_frase_usage(p_id);

  if v_count > 0 then
    raise exception 'en_uso' using errcode = 'P0001';
  end if;

  delete from public.frases_motivacionales where id = p_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_and_delete_contenido(p_old_id uuid, p_new_id uuid)
 RETURNS TABLE(affected integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.replace_and_delete_frase(p_old_id uuid, p_new_id uuid)
 RETURNS TABLE(affected integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_affected integer;
  v_exists   boolean;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- Validate old frase exists
  select exists(
    select 1 from public.frases_motivacionales where id = p_old_id
  ) into v_exists;

  if not v_exists then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  -- Validate new frase exists
  select exists(
    select 1 from public.frases_motivacionales where id = p_new_id
  ) into v_exists;

  if not v_exists then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  -- Capture affected count before the swap
  select count(distinct e.paciente_id) into v_affected
    from public.etapas_tratamiento e
   where e.frase_motivacional_id = p_old_id;

  v_affected := coalesce(v_affected, 0);

  -- Atomic swap: update references then delete original
  -- (update must come before delete due to ON DELETE RESTRICT FK)
  update public.etapas_tratamiento
     set frase_motivacional_id = p_new_id
   where frase_motivacional_id = p_old_id;

  delete from public.frases_motivacionales
   where id = p_old_id;

  return query select v_affected;
end;
$function$
;


