-- ---------------------------------------------------------------------------
-- resolver_documentos_legales_vigentes
-- ---------------------------------------------------------------------------
-- Única fuente de verdad de "¿son estos los documentos vigentes?", usada dos
-- veces: por el handler createAccount.ts ANTES de auth.admin.createUser, y
-- de nuevo DENTRO de la transacción de vincular_cuenta_paciente — el mismo
-- chequeo, para que un reintento o una carrera contra una republicación no
-- pueda colarse.
--
-- Fail-closed: si la tabla está vacía, si falta algún tipo del enum, si el
-- payload trae un documento de más, viejo, desconocido, duplicado o mal
-- formado, devuelve null. Solo devuelve los ids cuando el conjunto enviado es
-- EXACTAMENTE (igualdad de conjuntos, sin duplicados) el conjunto vigente
-- completo.
--
-- FIX: la validación original comparaba por COUNT (cantidad de matches =
-- jsonb_array_length = cantidad vigente), lo que permitía que un tipo válido duplicado N veces (N = cantidad de
-- tipos) reemplazara a un tipo que el caller nunca envió. Reescrita como
-- igualdad de conjuntos bidireccional + guard explícito de tipos duplicados.
--
-- Acceso: solo service_role. Los grants y el search_path los fija además una
-- migración hand-authored aparte (supabase/migrations/), porque db diff
-- (migra) no detecta ni EXECUTE grants ni proconfig — mismo patrón que
-- 76_rpcs_baja_voluntaria.sql.
-- ---------------------------------------------------------------------------

create or replace function public.resolver_documentos_legales_vigentes(p_documentos jsonb)
returns uuid[]
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_current_count  int;
  v_element        jsonb;
  v_tipo           public.tipo_documento_legal;
  v_payload_count  int;
  v_distinct_count int;
  v_ids            uuid[];
begin
  -- 1. La versión vigente por tipo es la de mayor publicado_at ya publicada
  --    (publicado_at <= now()). Fail closed si no hay una vigente para CADA
  --    tipo del enum — cubre tanto la tabla vacía como una migración de seed
  --    a medio aplicar.
  select count(*) into v_current_count
    from (
      select distinct on (d.tipo) d.tipo
        from public.documentos_legales d
       where d.publicado_at <= now()
       order by d.tipo, d.publicado_at desc, d.id desc
    ) as vigentes;

  if v_current_count <> (
    select count(*) from unnest(enum_range(null::public.tipo_documento_legal)) as t
  ) then
    return null;
  end if;

  -- 2. p_documentos debe ser un array jsonb, cada elemento un objeto con
  --    EXACTAMENTE las claves {tipo, version} (ambas string), y tipo debe
  --    castear a un valor conocido del enum. Fail closed (return null) ante
  --    cualquier forma inesperada o un tipo desconocido — NUNCA levantar: esta
  --    función se llama desde un pre-check sin autenticar (createAccount.ts)
  --    y un cast/formato inválido no puede convertirse en un 500.
  if jsonb_typeof(p_documentos) is distinct from 'array' then
    return null;
  end if;

  begin
    for v_element in select value from jsonb_array_elements(p_documentos)
    loop
      if jsonb_typeof(v_element) <> 'object'
         or not (v_element ?& array['tipo', 'version'])
         or (select count(*) from jsonb_object_keys(v_element)) <> 2
         or jsonb_typeof(v_element -> 'tipo') <> 'string'
         or jsonb_typeof(v_element -> 'version') <> 'string'
      then
        return null;
      end if;

      -- Falla cerrado (capturado más abajo) ante un tipo desconocido/mal
      -- escrito.
      v_tipo := (v_element ->> 'tipo')::public.tipo_documento_legal;
    end loop;
  exception
    when others then
      return null;
  end;

  -- 3. Sin tipos duplicados en el payload — un tipo repetido no puede
  --    reemplazar al tipo que el caller nunca envió (CRITICAL regression:
  --    el chequeo anterior comparaba por COUNT, no por conjunto, y dejaba
  --    pasar exactamente esto).
  select count(*), count(distinct payload.tipo) into v_payload_count, v_distinct_count
    from jsonb_to_recordset(p_documentos) as payload (tipo text, version text);

  if v_payload_count <> v_distinct_count then
    return null;
  end if;

  if v_payload_count <> v_current_count then
    return null;
  end if;

  -- 4. Igualdad de conjuntos bidireccional: ningún par del payload puede
  --    faltar en vigentes, y ningún vigente puede faltar en el payload.
  if exists (
    select payload.tipo, payload.version
      from jsonb_to_recordset(p_documentos) as payload (tipo text, version text)
     except
     select d.tipo::text, d.version
       from (
         select distinct on (d.tipo) d.tipo, d.version
           from public.documentos_legales d
          where d.publicado_at <= now()
          order by d.tipo, d.publicado_at desc, d.id desc
       ) as d
  ) then
    return null;
  end if;

  if exists (
    select d.tipo::text, d.version
      from (
        select distinct on (d.tipo) d.tipo, d.version
          from public.documentos_legales d
         where d.publicado_at <= now()
         order by d.tipo, d.publicado_at desc, d.id desc
      ) as d
    except
    select payload.tipo, payload.version
      from jsonb_to_recordset(p_documentos) as payload (tipo text, version text)
  ) then
    return null;
  end if;

  -- 5. Coincide exacto: devolver los ids vigentes (uno por tipo).
  select array_agg(d.id order by d.tipo) into v_ids
    from (
      select distinct on (d.tipo) d.id, d.tipo
        from public.documentos_legales d
       where d.publicado_at <= now()
       order by d.tipo, d.publicado_at desc, d.id desc
    ) as d;

  return v_ids;
end;
$$;

comment on function public.resolver_documentos_legales_vigentes(jsonb) is 'Resuelve los ids de documentos_legales vigentes (mayor publicado_at por tipo) si y solo si p_documentos (jsonb array de {tipo, version}, sin tipos duplicados) coincide EXACTAMENTE (igualdad de conjuntos bidireccional) con el conjunto vigente completo: todos los tipos del enum, ninguno de más, ninguna version vieja, ningún tipo repetido. Devuelve null en cualquier otro caso (fail-closed), incluida la tabla vacía, un tipo desconocido o un elemento mal formado. Llamada por createAccount.ts (pre-check) y vincular_cuenta_paciente (re-check transaccional). Acceso: service_role.';

revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from public;
revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from anon;
revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from authenticated;

grant execute on function public.resolver_documentos_legales_vigentes(jsonb) to service_role;
