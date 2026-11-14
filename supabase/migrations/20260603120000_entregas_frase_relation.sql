-- contenidoStep frase-fix: la frase pasa a ser entregable por semana, igual que el contenido.
--
-- 1. entregas_plan: contenido_id deja de ser obligatorio, se agrega frase_id, y un CHECK
--    garantiza que cada fila sea exactamente una pieza (un contenido de media O una frase).
-- 2. frases_motivacionales: se elimina causa_id — la frase es un catálogo plano igual que
--    contenidos; el agrupamiento por causa era un feature futuro sin uso (la app no lo lee
--    y create_frase ya insertaba causa_id = null).
-- 3. create_frase: se actualiza para no insertar la columna eliminada.
--
-- Escrita a mano (no via `supabase db diff`): db diff no captura bien estos cambios por el
-- ordering preexistente de is_admin() en el shadow DB. Sigue el patrón de migraciones del repo.

-- 1. entregas_plan -----------------------------------------------------------
alter table public.entregas_plan
  alter column contenido_id drop not null;

alter table public.entregas_plan
  add column frase_id uuid references public.frases_motivacionales (id);

alter table public.entregas_plan
  add constraint entrega_contenido_xor_frase
  check (num_nonnulls(contenido_id, frase_id) = 1);

comment on table public.entregas_plan is 'Plan real del paciente: cada fila es una pieza entregable por semana — un contenido (video/audio) o una frase, nunca ambos (CHECK xor).';

-- 2. frases_motivacionales ---------------------------------------------------
alter table public.frases_motivacionales
  drop column causa_id;

comment on table public.frases_motivacionales is 'Banco plano de frases entregables (texto). Se asignan por semana vía entregas_plan.frase_id, igual que los contenidos de media.';

-- 2b. etapas_tratamiento: se elimina frase_motivacional_id ------------------
-- Relación "una frase por tratamiento" que #24 dejó dormida: sin uso en app/,
-- sin setear en seed ni en register_paciente. Es redundante con el modelo
-- semanal (entregas_plan.frase_id). Se elimina para dejar una sola relación.
alter table public.etapas_tratamiento
  drop column frase_motivacional_id;

-- 2c. RPCs de CRUD de frase repuntados a entregas_plan.frase_id --------------
-- count_frase_usage y replace_and_delete_frase referenciaban la columna
-- eliminada; ahora la "frase en uso" es su asignación semanal en entregas_plan.
create or replace function public.count_frase_usage(p_id uuid)
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
    from public.entregas_plan ep
    join public.etapas_tratamiento e on e.id = ep.etapa_id
   where ep.frase_id = p_id;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.replace_and_delete_frase(p_old_id uuid, p_new_id uuid)
returns table(affected integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affected integer;
  v_exists   boolean;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select exists(select 1 from public.frases_motivacionales where id = p_old_id) into v_exists;
  if not v_exists then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  select exists(select 1 from public.frases_motivacionales where id = p_new_id) into v_exists;
  if not v_exists then
    raise exception 'no_encontrado' using errcode = 'P0002';
  end if;

  select count(distinct e.paciente_id) into v_affected
    from public.entregas_plan ep
    join public.etapas_tratamiento e on e.id = ep.etapa_id
   where ep.frase_id = p_old_id;

  v_affected := coalesce(v_affected, 0);

  update public.entregas_plan
     set frase_id = p_new_id
   where frase_id = p_old_id;

  delete from public.frases_motivacionales
   where id = p_old_id;

  return query select v_affected;
end;
$$;

-- 3. create_frase sin causa_id ----------------------------------------------
create or replace function public.create_frase(
  p_titulo      text,
  p_descripcion text,
  p_texto       text
)
returns table(
  id          uuid,
  titulo      text,
  descripcion text,
  texto       text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_texto is null or btrim(p_texto) = '' then
    raise exception 'texto_vacio' using errcode = '23514';
  end if;

  return query
    insert into public.frases_motivacionales (titulo, descripcion, texto, activo)
    values (p_titulo, p_descripcion, btrim(p_texto), true)
    returning
      frases_motivacionales.id,
      frases_motivacionales.titulo,
      frases_motivacionales.descripcion,
      frases_motivacionales.texto;
end;
$$;

comment on function public.create_frase(text, text, text) is
  'Inserta una nueva frase motivacional. Valida is_admin() y texto no vacío. Set-returning: devuelve la fila creada para que el hook la mapee.';
