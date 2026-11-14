-- ---------------------------------------------------------------------------
-- iniciar_nueva_etapa
-- ---------------------------------------------------------------------------
-- Abre una NUEVA etapa de tratamiento para un paciente que ya existe.
-- Es un cruce entre register_paciente (crea etapa + niveles + bloqueos +
-- alfabetos) y update_etapa_diagnostico (resuelve terapeuta/authz sobre un
-- paciente ya existente). Requiere que la etapa anterior ya esté cerrada
-- (finalizada/abandonada) via cerrar_etapa.
--
-- GATE DURO (DEC-21): si el paciente ya tiene una etapa activa
-- (fecha_finalizacion IS NULL), falla con etapa_activa_existente. No hay
-- re-diagnóstico implícito acá: cerrar_etapa es un paso previo obligatorio.
--
-- Authz: el terapeuta de la asignación activa del paciente (relación 1:1,
-- asignaciones_paciente.fecha_hasta IS NULL) o un admin. Si no hay asignación
-- activa (hueco de datos), cae a la última etapa (cualquier estado, la más
-- reciente) para resolver un terapeuta dueño, igual que
-- update_paciente_identidad -- pero SIN el filtro fecha_finalizacion IS NULL
-- de aquella función: acá ya sabemos (por el gate duro de arriba) que no hay
-- ninguna etapa abierta, así que ese filtro nunca matchearía.
--
-- DEC-22: la etapa arranca SIN entregas_plan. El terapeuta reasigna el
-- contenido después via set_entregas_plan; esta RPC no toca esa tabla, así
-- que no dispara generar_otp_activacion (el paciente ya tiene cuenta de un
-- tratamiento anterior).
--
-- current_date se establece server-side para evitar drift de timezone con el
-- cliente, igual que register_paciente/cerrar_etapa.
-- ---------------------------------------------------------------------------

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
  v_terapeuta_id      uuid;
  v_estado_eta_activa uuid;
  v_cantidad_niveles  integer;
  v_etapa_id          uuid;
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

  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
     order by et.fecha_inicio desc, et.created_at desc
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
  --    FK genérica) y resolver el estado 'activa' por slug.
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  select ee.id into v_estado_eta_activa
    from public.estados_etapa as ee
   where ee.codigo = 'activa';

  if not found then
    raise exception 'estado_etapa_activa_no_encontrado' using errcode = 'P0002';
  end if;

  -- 5. Insertar la etapa nueva.
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
    current_date,
    v_estado_eta_activa
  )
  returning id into v_etapa_id;

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

  -- 5c. Niveles de seguimiento (numero_nivel 1..cantidad_niveles), anclados
  --     a current_date = fecha_inicio de la etapa nueva.
  insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
  select v_etapa_id, g.n, (current_date + (g.n * interval '1 month'))::date
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- Sin entregas_plan (DEC-22): la etapa arranca vacía de contenido; el
  -- terapeuta lo reasigna después via set_entregas_plan.

  -- 6. Devolver el id de la etapa nueva.
  return v_etapa_id;
end;
$$;

comment on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';

grant execute on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;
