-- Schema para documentos legales: documentos_legales,
-- aceptaciones_documentos_legales, resolver_documentos_legales_vigentes.
-- GENERADA con `supabase db diff` y editada a mano.
--
-- Lo que este archivo NO tiene, a propósito: los ~200 `revoke
-- delete/insert/select/update ... from authenticated/service_role` que
-- `db diff` emitió para TODAS las tablas preexistentes (alfabetos,
-- algoritmos, asignaciones_paciente, ..., tipos_disco). Es el mismo ruido
-- documentado en 20260831120000_schema_comment_drift_and_authenticated_lockdown.sql
-- y en .claude/supabase-declarative-database-schema.md ("grant statements are
-- duplicated from default privileges"): la shadow DB de db diff reconstruye
-- los default privileges desde cero y los redeclara tabla por tabla contra la
-- base real, que ya los tiene por herencia. Cero drift real — se removió en
-- el origen, no filtrando la salida.
--
-- Los EXECUTE grants de resolver_documentos_legales_vigentes NO están acá:
-- migra no los detecta (.claude/skills/supabase-migration/SKILL.md, "Known
-- migra limitation"), van en una migración hand-authored aparte
-- (20260913183100_documentos_legales_resolver_grants.sql), mismo patrón que
-- 20260831140100_baja_voluntaria_paciente_grants.sql.

create type "public"."tipo_documento_legal" as enum ('CONSENTIMIENTO_APP_PACIENTE', 'TERMINOS_CONDICIONES_APP_PACIENTE');

  create table "public"."aceptaciones_documentos_legales" (
    "id" uuid not null default gen_random_uuid(),
    "paciente_id" uuid not null,
    "user_id" uuid,
    "documento_id" uuid not null,
    "tipo" public.tipo_documento_legal not null,
    "aceptado_at" timestamp with time zone not null default now()
      );

alter table "public"."aceptaciones_documentos_legales" enable row level security;

  create table "public"."documentos_legales" (
    "id" uuid not null default gen_random_uuid(),
    "tipo" public.tipo_documento_legal not null,
    "version" text not null,
    "titulo" text not null,
    "contenido_md" text not null,
    "publicado_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );

alter table "public"."documentos_legales" enable row level security;

CREATE INDEX aceptaciones_documentos_legales_documento_id_idx ON public.aceptaciones_documentos_legales USING btree (documento_id);

CREATE UNIQUE INDEX aceptaciones_documentos_legales_paciente_id_documento_id_key ON public.aceptaciones_documentos_legales USING btree (paciente_id, documento_id);

CREATE UNIQUE INDEX aceptaciones_documentos_legales_pkey ON public.aceptaciones_documentos_legales USING btree (id);

CREATE UNIQUE INDEX documentos_legales_id_tipo_key ON public.documentos_legales USING btree (id, tipo);

CREATE UNIQUE INDEX documentos_legales_pkey ON public.documentos_legales USING btree (id);

CREATE UNIQUE INDEX documentos_legales_tipo_version_key ON public.documentos_legales USING btree (tipo, version);

alter table "public"."aceptaciones_documentos_legales" add constraint "aceptaciones_documentos_legales_pkey" PRIMARY KEY using index "aceptaciones_documentos_legales_pkey";

alter table "public"."documentos_legales" add constraint "documentos_legales_pkey" PRIMARY KEY using index "documentos_legales_pkey";

alter table "public"."aceptaciones_documentos_legales" add constraint "aceptaciones_documentos_legales_documento_id_tipo_fkey" FOREIGN KEY (documento_id, tipo) REFERENCES public.documentos_legales(id, tipo) ON DELETE RESTRICT not valid;

alter table "public"."aceptaciones_documentos_legales" validate constraint "aceptaciones_documentos_legales_documento_id_tipo_fkey";

alter table "public"."aceptaciones_documentos_legales" add constraint "aceptaciones_documentos_legales_paciente_id_documento_id_key" UNIQUE using index "aceptaciones_documentos_legales_paciente_id_documento_id_key";

alter table "public"."aceptaciones_documentos_legales" add constraint "aceptaciones_documentos_legales_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE RESTRICT not valid;

alter table "public"."aceptaciones_documentos_legales" validate constraint "aceptaciones_documentos_legales_paciente_id_fkey";

alter table "public"."documentos_legales" add constraint "documentos_legales_id_tipo_key" UNIQUE using index "documentos_legales_id_tipo_key";

alter table "public"."documentos_legales" add constraint "documentos_legales_tipo_version_key" UNIQUE using index "documentos_legales_tipo_version_key";

alter table "public"."documentos_legales" add constraint "documentos_legales_version_check" CHECK ((version ~ '^\d+\.\d+$'::text)) not valid;

alter table "public"."documentos_legales" validate constraint "documentos_legales_version_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rechazar_modificacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  raise exception 'modificacion_no_permitida'
    using errcode = '42501',
          detail  = format('%s es insert-only; %s no está permitido', tg_table_name, tg_op);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolver_documentos_legales_vigentes(p_documentos jsonb)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

grant references on table "public"."aceptaciones_documentos_legales" to "authenticated";

grant references on table "public"."aceptaciones_documentos_legales" to "service_role";

grant trigger on table "public"."aceptaciones_documentos_legales" to "service_role";

grant truncate on table "public"."aceptaciones_documentos_legales" to "service_role";

grant references on table "public"."documentos_legales" to "authenticated";

grant references on table "public"."documentos_legales" to "service_role";

grant trigger on table "public"."documentos_legales" to "service_role";

grant truncate on table "public"."documentos_legales" to "service_role";

CREATE TRIGGER rechazar_modificacion_aceptaciones_documentos_legales BEFORE UPDATE ON public.aceptaciones_documentos_legales FOR EACH ROW EXECUTE FUNCTION public.rechazar_modificacion();

-- TRUNCATE en aceptaciones_documentos_legales estaba desprotegido —
-- service_role hereda el privilegio TRUNCATE por default privileges (mismo
-- gap que documentos_legales) y solo se aprobó DELETE filtrado, nunca
-- TRUNCATE. Nada de este archivo está desplegado todavía, así que se pliega
-- acá en vez de generar una migración nueva.
CREATE TRIGGER rechazar_truncate_aceptaciones_documentos_legales BEFORE TRUNCATE ON public.aceptaciones_documentos_legales FOR EACH STATEMENT EXECUTE FUNCTION public.rechazar_modificacion();

CREATE TRIGGER rechazar_modificacion_documentos_legales BEFORE DELETE OR UPDATE ON public.documentos_legales FOR EACH ROW EXECUTE FUNCTION public.rechazar_modificacion();

CREATE TRIGGER rechazar_truncate_documentos_legales BEFORE TRUNCATE ON public.documentos_legales FOR EACH STATEMENT EXECUTE FUNCTION public.rechazar_modificacion();

-- revoke insert, update, delete on ambas tablas para authenticated/anon —
-- declarado en supabase/schemas/23_documentos_legales.sql y
-- 24_aceptaciones_documentos_legales.sql, pero db diff no emitió un
-- statement propio para esto en esta corrida (mismo tipo de discrepancia
-- shadow-db-vs-real documentado para truncate/trigger en
-- 00_authenticated_lockdown.sql). Se declara acá explícitamente para no
-- depender de que el diff lo detecte.
revoke insert, update, delete on table "public"."documentos_legales" from "authenticated";
revoke insert, update, delete on table "public"."documentos_legales" from "anon";
revoke insert, update, delete on table "public"."aceptaciones_documentos_legales" from "authenticated";
revoke insert, update, delete on table "public"."aceptaciones_documentos_legales" from "anon";

-- revoke truncate, trigger from authenticated — MISMO GAP que
-- supabase/tests/privilege_lockdown.sql BLOCK 1 documenta y que
-- 20260812200100_new_media_types_grants_and_comments.sql ya tuvo que cerrar
-- para otras 6 tablas. `00_authenticated_lockdown.sql` declara
-- `alter default privileges ... revoke truncate, trigger on tables from
-- authenticated` del lado de supabase/schemas/, pero ESO ES SOLO PARA QUE LA
-- SHADOW DB DE `db diff` COINCIDA — nunca se convirtió en una migración real,
-- así que nunca corrió contra la base real. Confirmado en local corriendo
-- privilege_lockdown.sql BLOCK 1 después de aplicar la migración generada sin
-- este bloque: aceptaciones_documentos_legales y documentos_legales
-- aparecían con TRUNCATE para authenticated (TRUNCATE ignora RLS por
-- completo — no es una fuga de datos, es un borrado de tabla entera).
revoke truncate, trigger on table "public"."documentos_legales" from "authenticated";
revoke truncate, trigger on table "public"."aceptaciones_documentos_legales" from "authenticated";

-- grant select a authenticated (para que admin_select_all_* sea alcanzable) y
-- grant delete a service_role — mismo hallazgo: el default
-- ACL del rol postgres en este proyecto (pg_default_acl) NO incluye
-- select/insert/update/delete para authenticated ni service_role en tablas
-- nuevas, a diferencia de "pacientes" (otorgado en el
-- 20260503204655_initial_schema.sql original, antes de este esquema). Sin
-- estos grants, la RLS policy admin_select_all_* nunca se alcanza (falta el
-- privilegio de tabla de base) y purge-test-paciente.mjs no podría borrar
-- aceptaciones de pacientes de prueba con service_role.
grant select on table "public"."documentos_legales" to "authenticated";
grant select on table "public"."aceptaciones_documentos_legales" to "authenticated";
grant select, delete on table "public"."aceptaciones_documentos_legales" to "service_role";

-- grant select a service_role en documentos_legales: el vault
-- (vault de producto) lee los documentos vigentes por REST con la
-- service-role key. Mismo hallazgo de default ACL que arriba: sin este
-- grant, "documentos_legales?select=..." con la service-role key falla con
-- "permission denied for table documentos_legales". SELECT en
-- aceptaciones_documentos_legales para service_role (arriba) cierra el mismo
-- tipo de gap: DELETE-only no alcanza para un "DELETE ... WHERE paciente_id
-- = ..." porque Postgres necesita evaluar el predicado WHERE, lo cual exige
-- SELECT.
grant select on table "public"."documentos_legales" to "service_role";

-- Matriz de privilegios explícita para service_role, determinística sin
-- importar qué otorgan las default privileges de este proyecto en tablas
-- nuevas (documentado como REFERENCES/TRIGGER/TRUNCATE arriba, y que
-- `db diff` sí capturó como los `grant truncate ... to service_role` de más
-- arriba). documentos_legales es SELECT-only para service_role (el seed la
-- inserta como postgres, no como service_role — ver migración
-- 20260913190000_seed_documentos_legales.sql); aceptaciones_documentos_legales
-- es SELECT+DELETE-only (vincular_cuenta_paciente la inserta corriendo como
-- security definer, con el owner de la función, nunca como service_role —
-- ver 73_otps_functions.sql). Los triggers de inmutabilidad/TRUNCATE siguen
-- siendo la protección real; estos revokes cierran el privilegio a nivel de
-- grant para que la garantía no dependa de qué versión del CLI generó las
-- default privileges.
revoke insert, update, delete, truncate on table "public"."documentos_legales" from "service_role";
revoke insert, update, truncate on table "public"."aceptaciones_documentos_legales" from "service_role";
