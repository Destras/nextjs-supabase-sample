-- activacionPorTelefono, Epic 2 Task 2.2: chequeo de duplicados que consume el
-- aviso del panel (ADR-0006) -con un teléfono compartido el paciente no puede
-- activarse solo, y el alta/edición es el único momento en que se puede evitar
-- gratis cargando otro número.
--
-- Hand-written (db diff no funciona en este repo — shadow DB rota, ver
-- supabase/migrations/20260830170100_baja_voluntaria_foundational.sql).
-- Mirrors el estado final de supabase/schemas/71_rpcs_pacientes.sql. Requiere
-- public.normalizar_telefono_ar (Epic 0, Task 0.1) y pacientes_telefono_idx,
-- timestamp posterior a
-- supabase/migrations/20260915130000_fecha_nacimiento_obligatoria.sql.
--
-- create or replace de telefono_en_otra_ficha: solo booleano -nunca id,
-- nombre ni terapeuta de la otra ficha-, autorización NULL-safe (terapeuta
-- existente o admin, mismo patrón que baja_voluntaria_paciente).

create or replace function public.telefono_en_otra_ficha(
  p_telefono             text,
  p_excluir_paciente_id  uuid default null
)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_telefono text;
begin
  -- 1. Autorización NULL-safe: terapeuta existente o admin. Sin sesión,
  --    auth.uid() es null, el exists da falso y el guard falla cerrado.
  if not (
    public.is_admin()
    or exists (select 1 from public.terapeutas where id = auth.uid())
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Normalizar a la forma canónica (fuente única: normalizar_telefono_ar).
  --    Un input que no normaliza no puede colisionar de verdad.
  v_telefono := public.normalizar_telefono_ar(p_telefono);

  if v_telefono is null then
    return false;
  end if;

  -- 3. Chequear si OTRA ficha (excluyendo p_excluir_paciente_id, si vino)
  --    tiene el mismo teléfono canónico. Solo booleano.
  return exists (
    select 1
      from public.pacientes
     where telefono = v_telefono
       and (p_excluir_paciente_id is null or id <> p_excluir_paciente_id)
  );
end;
$$;

comment on function public.telefono_en_otra_ficha(text, uuid) is
  'Chequeo de duplicados de teléfono (activacionPorTelefono, ADR-0006): normaliza p_telefono (normalizar_telefono_ar) y devuelve true si OTRA ficha de pacientes (excluyendo p_excluir_paciente_id) ya lo tiene. Solo booleano -nunca id, nombre ni terapeuta de la otra ficha-, para que el panel avise sin identificar de quién es. Un teléfono que no normaliza devuelve false. Acceso: cualquier terapeuta o admin (autorización NULL-safe: is_admin() o auth.uid() resuelve a un terapeuta existente). Usa pacientes_telefono_idx.';

grant execute on function public.telefono_en_otra_ficha(text, uuid) to authenticated;

revoke execute on function public.telefono_en_otra_ficha(text, uuid) from public;
revoke execute on function public.telefono_en_otra_ficha(text, uuid) from anon;
