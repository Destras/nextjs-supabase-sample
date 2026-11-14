-- =============================================================================
-- seguridadPanel / SEG-006 — Un paciente, a lo sumo una etapa abierta
-- =============================================================================
-- Que un paciente no tenga dos tratamientos en curso lo validaba solo
-- iniciar_nueva_etapa, con un `if exists` antes de insertar. Dos llamadas en
-- paralelo pasan las dos ese chequeo, y cualquier otra escritura (hoy
-- register_paciente; mañana un RPC nuevo) no lo tenía. Todo lo que lee "la
-- etapa activa" (get_mi_plan_semanal, las alertas, el dashboard) asume que hay
-- una sola.
--
-- "Abierta" = fecha_finalizacion is null. Es el criterio de get_mi_plan_semanal,
-- iniciar_nueva_etapa, cerrar_etapa, set_entregas_plan y derive_alertas_activas;
-- el estado_id acompaña pero no define.
--
-- Esta migración:
--   1. Si ya hay pacientes con más de una etapa abierta, FALLA con un mensaje
--      claro y no toca nada (en vez de reventar con el error crudo del índice).
--      Consulta para verlos:
--        select paciente_id, count(*)
--          from public.etapas_tratamiento
--         where fecha_finalizacion is null
--         group by 1 having count(*) > 1;
--   2. Crea el índice único parcial.
--   3. Recrea iniciar_nueva_etapa: si el insert choca contra el índice (la
--      carrera que el `if exists` no ve), devuelve el mismo error legible,
--      etapa_activa_existente, en vez del 23505. Mismo cuerpo, firma, security,
--      search_path, comment y grants.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

-- 1. No seguir si los datos ya violan la regla.
do $$
declare
  v_pacientes int;
begin
  select count(*) into v_pacientes
    from (
      select e.paciente_id
        from public.etapas_tratamiento as e
       where e.fecha_finalizacion is null
       group by e.paciente_id
      having count(*) > 1
    ) as duplicados;

  if v_pacientes > 0 then
    raise exception
      'SEG-006: % paciente(s) tienen más de una etapa abierta (fecha_finalizacion is null). No se crea el índice. Resolver a mano con el terapeuta (cerrar la etapa que sobra) y volver a correr la migración.',
      v_pacientes
      using errcode = 'P0001',
            hint    = 'select paciente_id, count(*) from public.etapas_tratamiento where fecha_finalizacion is null group by 1 having count(*) > 1;';
  end if;
end;
$$;

-- 2. La garantía.
create unique index etapas_tratamiento_una_abierta_por_paciente_idx
  on public.etapas_tratamiento (paciente_id)
  where fecha_finalizacion is null;

-- 3. iniciar_nueva_etapa conserva su error legible ante una carrera.
create or replace function public.iniciar_nueva_etapa(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabetos    jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_etapa_id             uuid;
  v_restriccion          text;
begin
  -- 1. Gate duro: no se puede abrir una etapa nueva si ya hay una activa.
  --    La anterior debe finalizarse/abandonarse (cerrar_etapa) antes.
  if exists (
        select 1
          from public.etapas_tratamiento as et
         where et.paciente_id = p_paciente_id
           and et.fecha_finalizacion is null
      ) then
    raise exception 'etapa_activa_existente'
      using errcode = 'P0001',
            detail  = 'el paciente ya tiene una etapa de tratamiento activa; cerrala antes de abrir una nueva';
  end if;

  -- 2. Resolver el terapeuta dueño desde la asignación activa (relación 1:1).
  --    Fallback a la última etapa (cualquier estado) si no hay asignación
  --    activa, igual que update_paciente_identidad.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  -- Sin filtro fecha_finalizacion is null (a diferencia de
  -- update_paciente_identidad): acá ya sabemos, por el gate duro del paso 1,
  -- que no hay ninguna etapa abierta — ese filtro nunca matchearía. Por eso
  -- este order by recorre TODAS las etapas del paciente, cerradas incluidas,
  -- y coalesce(fecha_inicio, created_at) importa de verdad acá: con
  -- `fecha_inicio desc` a secas (NULLS FIRST en Postgres), una etapa cerrada
  -- que nunca arrancó (DEC-11, fecha_inicio null + fecha_finalizacion seteada)
  -- flotaría al tope y le robaría el terapeuta a la etapa real más reciente.
  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
     order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
     limit 1;
  end if;

  -- 3. Autorizar. Comparación NULL-safe: si v_terapeuta_id no resuelve,
  --    `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO. El
  --    `is not null` lo cierra; is_admin() sigue permitiendo al admin aunque
  --    no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 4. Pre-chequear la modalidad (error descriptivo en lugar de violación de
  --    FK genérica) y resolver el estado 'pendiente' por slug. inicioTratamiento:
  --    la etapa nace 'pendiente' (sin arrancar), no 'activa'. El slug lo
  --    garantiza el insert idempotente del schema declarativo (Epic 0, Task 0.1).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado' using errcode = 'P0002';
  end if;

  -- 5. Insertar la etapa nueva. inicioTratamiento: fecha_inicio NULL + estado
  --    'pendiente' — la etapa se crea SIN ARRANCAR. Arranca cuando
  --    set_entregas_plan completa el plan de contenido (Task 1.2).
  --
  --    El índice único etapas_tratamiento_una_abierta_por_paciente_idx
  --    (seguridadPanel / SEG-006) es la garantía real de "una sola abierta":
  --    el gate del paso 1 no ve la etapa que otra llamada en paralelo todavía
  --    no confirmó. Si el insert choca contra ese índice, se devuelve el mismo
  --    error legible del gate en vez del 23505 crudo.
  begin
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
      p_paciente_id,
      v_terapeuta_id,
      p_causa_id,
      p_algoritmo_id,
      p_modalidad_id,
      null,
      v_estado_eta_pendiente
    )
    returning id into v_etapa_id;
  exception
    when unique_violation then
      get stacked diagnostics v_restriccion = constraint_name;
      if v_restriccion = 'etapas_tratamiento_una_abierta_por_paciente_idx' then
        raise exception 'etapa_activa_existente'
          using errcode = 'P0001',
                detail  = 'el paciente ya tiene una etapa de tratamiento activa; cerrala antes de abrir una nueva';
      end if;
      raise;
  end;

  -- 5a. Bloqueos de la etapa (bulk via unnest; array vacío/NULL genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 5b. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío
  --     ('[]') genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 5c. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla se crea igual (invariante "toda etapa
  --     tiene su grilla"), pero SIN fecha_seguimiento_esperada — la etapa
  --     todavía no arrancó. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- Sin entregas_plan (DEC-22): la etapa arranca vacía de contenido; el
  -- terapeuta lo reasigna después via set_entregas_plan.

  -- 6. Devolver el id de la etapa nueva.
  return v_etapa_id;
end;
$$;

