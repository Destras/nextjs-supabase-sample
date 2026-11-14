-- set_entregas_plan: RPC de full-replace del plan de entregas de una etapa.
--
-- Full-replace del plan de entregas de una etapa en una transacción atómica:
--   1. Borra todas las filas existentes de entregas_plan para la etapa.
--   2. Inserta las filas del JSONB recibido.
--
-- El JSONB debe ser un array de objetos con:
--   semana       integer  (1-based; dia_offset = (semana - 1) * 7)
--   orden        integer
--   contenido_id text     (uuid | '' | null)  -- XOR con frase_id
--   frase_id     text     (uuid | '' | null)  -- XOR con contenido_id
--
-- El CHECK entrega_contenido_xor_frase valida el XOR por fila;
-- si algún item lo viola, la transacción entera aborta.
--
-- Nota: comment on, grant execute y set search_path (proconfig) no son
-- capturados por supabase db diff (caveats conocidos de migra) →
-- se incluyen manualmente en esta migración.

set check_function_bodies = off;

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  -- 1. Resolver la etapa y obtener el terapeuta dueño.
  select e.terapeuta_id into v_terapeuta_id
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  if not (public.is_admin() or auth.uid() = v_terapeuta_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  delete from public.entregas_plan
   where etapa_id = p_etapa_id;

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, frase_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    nullif(item ->> 'frase_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item;
  -- El CHECK entrega_contenido_xor_frase valida XOR por fila;
  -- un item mal formado aborta la transacción entera.
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Acceso: el terapeuta dueño de la etapa o un admin. Escritura exclusivamente via security definer; la RLS de entregas_plan permanece select-only.';

-- grant execute: db diff no captura EXECUTE grants, se agrega manualmente.
grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
