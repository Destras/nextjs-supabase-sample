-- baja-voluntaria-cuenta-paciente, Fase 1 (DB Foundational): notificaciones_outbox
-- cascade FK + register_paciente baja_voluntaria email guard.
--
-- DEVIATION FROM THE NON-NEGOTIABLE "generate via `supabase db diff`" RULE —
-- DISCLOSED, NOT SILENT:
-- `supabase db diff` builds its "after" shadow database by replaying every
-- file under supabase/schemas/*.sql in lexicographic glob order (config.toml
-- schema_paths = ["./schemas/*.sql"]). That replay fails on THIS REPO, on
-- `main`, independent of this change:
--   ERROR: function public.is_admin() does not exist (SQLSTATE 42883)
--   At statement: create policy "admin_select_all_profiles" on public.profiles
--   for select to authenticated using (public.is_admin())
-- `11_profiles.sql` calls `public.is_admin()` in a policy predicate, but
-- `is_admin()` is not defined until `25_admin_functions.sql` — a pre-existing
-- ordering bug (git blame: `is_admin()` was moved from 62_ to 25_ in commit
-- ff19849 "para corregir orden de carga", which fixed it for consumers after
-- 25_ but not for 11_profiles.sql, which loads at position 11). Verified this
-- is unrelated to this change by reproducing it on a clean `main` checkout
-- (git stash) before writing this file. Likely never caught before because
-- the most recent PR touching migrations (new-media-types) had no Docker
-- access and hand-authored+diffed migrations "verified byte-identical"
-- without ever running a real `supabase db diff` (see engram
-- sdd/new-media-types/apply-progress, PR1 note on 20260812195700).
--
-- Fix (moving is_admin() to load before 11_profiles.sql, e.g. into a
-- 00_-prefixed file per this repo's own supabase-migration skill rule 2) is
-- out of scope for this slice — it touches schema file organization used by
-- every RLS policy in the project, not the 3 files this slice owns. Flagged
-- for a follow-up task; NOT fixed here.
--
-- This migration is hand-authored as a result, mirroring the exact target
-- state of supabase/schemas/60_notificaciones_outbox.sql and
-- supabase/schemas/71_rpcs_pacientes.sql (register_paciente). It must be
-- regenerated/reconciled via a real `supabase db diff` once the ordering bug
-- above is fixed, per the supabase-migration skill's non-negotiable rule.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notificaciones_outbox.destinatario_id: NO ACTION -> ON DELETE CASCADE
-- ---------------------------------------------------------------------------
alter table public.notificaciones_outbox
  drop constraint notificaciones_outbox_destinatario_id_fkey;

alter table public.notificaciones_outbox
  add constraint notificaciones_outbox_destinatario_id_fkey
  foreign key (destinatario_id) references public.profiles (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- register_paciente: add the paciente_dado_de_baja guard (ADR-3)
-- ---------------------------------------------------------------------------
create or replace function public.register_paciente(
  p_nombre            text,
  p_fecha_nacimiento  date,
  p_email             text,
  p_telefono          text,
  p_causa_id          uuid,
  p_algoritmo_id      uuid,
  p_modalidad_id      uuid,
  p_bloqueo_ids       uuid[],
  p_alfabetos         jsonb,
  p_terapeuta_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_pac_activo    uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_paciente_id          uuid;
  v_etapa_id             uuid;
begin
  -- 1. Resolver terapeuta y validar autorización.
  --    Un terapeuta solo puede registrar pacientes para sí mismo.
  --    Un admin puede registrar para cualquier terapeuta.
  v_terapeuta_id := coalesce(p_terapeuta_id, auth.uid());

  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Resolver ids de estado por slug (slugs verificados en seed.sql:181-187).
  select ep.id into v_estado_pac_activo
    from public.estados_paciente as ep
   where ep.codigo = 'activo';

  if not found then
    raise exception 'estado_paciente_activo_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- inicioTratamiento: la etapa nace 'pendiente' (sin arrancar), no 'activa'.
  -- El slug lo garantiza el insert idempotente del schema declarativo
  -- (inicioTratamiento Epic 0, Task 0.1), no el seed.
  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- 3. Resolver cantidad_niveles de la modalidad (pre-chequeo explícito para
  --    un error descriptivo en lugar de una violación de FK genérica).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 4. Inserts en orden dentro de la transacción implícita de la función.

  -- 4a. Paciente base.
  --     Email es obligatorio (DEC-E3-2): fallar rápido antes de cualquier insert.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  -- baja-voluntaria-cuenta-paciente (Fase 1, ADR-3): si el email pertenece a
  -- un paciente que ya se dio de baja voluntariamente, lanzar un error
  -- legible en vez de dejar que el insert de abajo falle con el 23505 crudo
  -- de pacientes_email_key. Comparación exacta (= btrim(p_email)), NO lower():
  -- debe ser co-extensiva con el índice único, o este guard dispararía para
  -- un email que en los hechos hubiera insertado con éxito. No habilita
  -- re-alta (fuera de alcance) — solo hace legible el fallo.
  if exists (
    select 1
      from public.pacientes as p
      join public.estados_paciente as ep on ep.id = p.estado_id
     where p.email = btrim(p_email)
       and ep.codigo = 'baja_voluntaria'
  ) then
    raise exception 'paciente_dado_de_baja'
      using errcode = 'P0001',
            detail  = 'El email pertenece a un paciente que se dio de baja; la re-alta no está soportada';
  end if;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, fecha_alta)
  values (
    btrim(p_nombre),
    p_fecha_nacimiento,
    btrim(p_email),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    v_estado_pac_activo,
    current_date
  )
  returning id into v_paciente_id;

  -- 4b. Asignación terapeuta-paciente (fecha_hasta NULL = activa).
  --     asignado_por = auth.uid() siempre: el caller queda auditado,
  --     incluso si es un admin asignando a otro terapeuta.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por)
  values (v_paciente_id, v_terapeuta_id, current_date, auth.uid());

  -- 4c. Etapa de tratamiento inicial (fecha_finalizacion NULL = en curso).
  --     inicioTratamiento: fecha_inicio NULL + estado 'pendiente' — la etapa
  --     se crea SIN ARRANCAR. Arranca cuando set_entregas_plan completa el
  --     plan de contenido (Task 1.2), no en el alta.
  insert into public.etapas_tratamiento (
    paciente_id,
    terapeuta_id,
    causa_id,
    algoritmo_id,
    modalidad_id,
    fecha_inicio,
    estado_id
  )
  values (
    v_paciente_id,
    v_terapeuta_id,
    p_causa_id,
    p_algoritmo_id,
    p_modalidad_id,
    null,
    v_estado_eta_pendiente
  )
  returning id into v_etapa_id;

  -- 4d. Bloqueos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 4e. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío ('[]')
  --     genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 4f. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla de N niveles se crea igual (invariante
  --     "toda etapa tiene su grilla"), pero SIN fecha_seguimiento_esperada —
  --     la etapa todavía no arrancó, no hay fecha_inicio contra la cual
  --     anclar la agenda. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';
