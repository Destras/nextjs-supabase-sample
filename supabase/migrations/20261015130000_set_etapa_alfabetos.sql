-- =============================================================================
-- set_etapa_alfabetos (feature alfabetosReales, Epic 1, Task 1.1)
-- =============================================================================
-- RPC que reemplaza los alfabetos de la etapa activa sin gate de frescura.
-- Escrita a mano (supabase db diff no funciona en este repo).
-- Rollback: supabase/rollbacks/20261015130000_set_etapa_alfabetos.down.sql
-- =============================================================================

begin;

create or replace function public.set_etapa_alfabetos(
  p_paciente_id uuid,
  p_alfabetos   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_terapeuta_id uuid;
begin
  -- 1. Resolver y bloquear la etapa activa (mismo orden determinístico que
  --    update_etapa_diagnostico).
  select et.id, et.terapeuta_id
    into v_etapa_id, v_terapeuta_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1
     for update of et;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Guard "admin o dueño" (SEG-008), NULL-safe: ver update_etapa_diagnostico.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Sin gate de frescura (ver cabecera).

  -- 4. Reemplazar alfabetos.
  delete from public.etapa_alfabetos where etapa_id = v_etapa_id;
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         (item ->> 'numero')::smallint
    from jsonb_array_elements(coalesce(p_alfabetos, '[]'::jsonb)) as item;
end;
$$;

comment on function public.set_etapa_alfabetos(uuid, jsonb) is
  'Reemplaza los alfabetos de la etapa activa de un paciente. p_alfabetos es un jsonb array con una entrada {alfabeto_id, numero} por número ([] o null = ninguno); el rango lo valida el trigger validar_numero_alfabeto. Acceso: terapeuta de la etapa o admin. Sin gate de frescura: los alfabetos no cambian el tratamiento (ADR 0015). La etapa se bloquea con for update para serializar guardados simultáneos.';

revoke execute on function public.set_etapa_alfabetos(uuid, jsonb) from public, anon;
grant execute on function public.set_etapa_alfabetos(uuid, jsonb) to authenticated;

commit;
