-- =============================================================================
-- seguridadPanel / SEG-002 — Un paciente solo abre los archivos liberados de su plan
-- =============================================================================
-- Las policies de SELECT de storage.objects de los buckets `contenidos` y
-- `contenidos-imagenes` dejaban leer —y por lo tanto firmar— cualquier objeto a
-- cualquier `authenticated`. Un paciente podía abrir archivos de semanas que
-- todavía no le tocaban y contenido que no estaba en su plan.
--
-- Esta migración:
--   1. Crea public.entrega_liberada: la regla del goteo semanal en un solo
--      lugar (hoy >= fecha_inicio + floor(dia_offset / 7) * 7).
--   2. Recrea get_mi_plan_semanal para que su 'futura' salga de esa función.
--      Mismo contrato y mismo resultado: (semana - 1) * 7 es el dia_offset del
--      inicio de la semana, o sea la fecha_desbloqueo que ya comparaba.
--      `create or replace` conserva sus grants.
--   3. Crea public.paciente_puede_ver_objeto: true si el usuario actual es un
--      paciente con tratamiento en curso y el objeto es de una entrega ya
--      liberada de su plan.
--   4. Reemplaza las dos policies de SELECT: lee la consola (cualquier objeto)
--      o el paciente (lo liberado de su plan). contenidos-imagenes conserva su
--      predicado de forma. Las policies de INSERT/UPDATE/DELETE no se tocan.
--   5. Crea los tres índices que usa la función por objeto.
--
-- La app del paciente sigue firmando ella misma con los paths que le devuelve
-- get_mi_plan_semanal, que solo entrega paths de semanas no futuras.
--
-- REVERTIR RÁPIDO (si la app deja de reproducir contenido en producción): el
-- SQL exacto está en .docs/features/seguridadPanel/STATE.md.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.entrega_liberada
-- ---------------------------------------------------------------------------

create or replace function public.entrega_liberada(
  p_fecha_inicio date,
  p_dia_offset   integer
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    public.hoy() >= p_fecha_inicio + floor(p_dia_offset / 7)::int * 7,
    false
  );
$$;

comment on function public.entrega_liberada(date, integer) is
  'Regla única del goteo semanal: true si public.hoy() >= fecha_inicio + floor(dia_offset/7)*7 (el inicio de la semana de esa entrega). '
  'fecha_inicio null → false. La comparten get_mi_plan_semanal (estadoSemana futura = no liberada) y paciente_puede_ver_objeto (policy de lectura de Storage). '
  'Privada: sin execute para anon ni authenticated; la llaman funciones security definer.';

revoke execute on function public.entrega_liberada(date, integer) from public, anon, authenticated;
grant execute on function public.entrega_liberada(date, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. get_mi_plan_semanal: 'futura' sale de public.entrega_liberada
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_plan_semanal()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_fecha_inicio date;
  v_result      jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    No se necesita la modalidad: las semanas salen de las entregas_plan realmente
  --    cargadas (el plan se autoriza completo antes de generar el OTP).
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Armar el array de semanas en un único query con CTEs (DEC-3-1…DEC-3-4).
  --    Una fila de salida por SEMANA (no por entrega): fechaDesbloqueo es el
  --    inicio de la semana (fecha_inicio + (semana-1)*7), robusto a entregas en
  --    días distintos dentro de la misma semana (evita semanas duplicadas).
  with base as (
    -- Una fila por entrega_plan: deriva semana y los campos de contenido.
    -- La frase ya NO sale de acá (Task 2.2): frase_id/frases_motivacionales
    -- fueron retirados de esta CTE; la lista de semanas sigue viniendo de
    -- entregas_plan (DEC-2-1), pero su contenido de frases se resuelve más
    -- abajo con la CTE frases_por_semana.
    select
      floor(ep.dia_offset / 7)::int + 1 as semana,
      ep.orden,
      ep.dia_offset,
      ep.contenido_id,
      c.id           as pieza_id,
      c.tipo         as pieza_tipo,
      c.titulo       as pieza_titulo,
      c.descripcion  as pieza_descripcion,
      c.recurso_ref  as pieza_recurso_ref,
      c.duracion_seg as pieza_duracion
    from public.entregas_plan as ep
    left join public.contenidos as c on c.id = ep.contenido_id
    where ep.etapa_id = v_etapa_id
  ),
  semanas as (
    -- Una fila por semana distinta; fecha_desbloqueo = inicio de la semana.
    select
      b.semana,
      (v_fecha_inicio + (b.semana - 1) * 7)::date as fecha_desbloqueo
    from base as b
    group by b.semana
  ),
  marcadas as (
    -- estadoSemana por semana. Ventana semiabierta [desbloqueo, desbloqueo+7).
    select
      s.semana,
      s.fecha_desbloqueo,
      -- 'futura' sale de public.entrega_liberada, la MISMA función que usa la
      -- policy de lectura de Storage (paciente_puede_ver_objeto): lo que este
      -- RPC oculta es exactamente lo que el bucket rechaza. (semana - 1) * 7
      -- es el dia_offset del inicio de la semana, o sea fecha_desbloqueo.
      case
        when not public.entrega_liberada(v_fecha_inicio, (s.semana - 1) * 7) then 'futura'
        when public.hoy() >= s.fecha_desbloqueo + 7 then 'anterior'
        else 'actual'
      end as estado_semana
    from semanas as s
  ),
  frases_por_semana as (
    -- Frases derivadas de la etapa (Task 0.3, epic-0): 3 objetos por semana
    -- ya ordenados por orden. Joineada por semana contra `marcadas`, nunca
    -- agrega semanas nuevas (frases_de_etapa puede cubrir más semanas que
    -- las que tienen media cargada; el join en el select final filtra eso).
    select
      f.semana,
      jsonb_agg(
        jsonb_build_object(
          'orden',  f.orden,
          'origen', f.origen,
          'texto',  f.texto
        )
        order by f.orden
      ) as frases
    from public.frases_de_etapa(v_etapa_id) as f
    group by f.semana
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana',          m.semana,
      'estadoSemana',    m.estado_semana,
      'fechaDesbloqueo', m.fecha_desbloqueo,
      -- piezas: filas de media (contenido_id not null) de la semana, ordenadas
      -- por (orden, dia_offset). recursoRef E imagenes nuleados server-side
      -- para futuras, en el MISMO case cada uno (design §6 ADR-5): ambos
      -- keys leen el mismo m.estado_semana en el mismo scope, y el case de
      -- imagenes corta en corto en 'futura' — el subquery a
      -- contenido_imagenes directamente NO SE EVALÚA para una semana futura,
      -- los paths no solo se descartan, nunca se leen. No repetir el error de
      -- separar esta regla en un case/CTE distinto (así casi se pierde
      -- `frases`, ver DEC-9). Semana sin media devuelve piezas: [] (coalesce).
      'piezas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',          b.pieza_id,
            'tipo',        b.pieza_tipo,
            'titulo',      b.pieza_titulo,
            'descripcion', b.pieza_descripcion,
            'recursoRef',  case when m.estado_semana = 'futura' then null else b.pieza_recurso_ref end,
            'imagenes',    case
                              when m.estado_semana = 'futura' then '[]'::jsonb
                              else coalesce((
                                select jsonb_agg(
                                         jsonb_build_object('path', ci.path, 'orden', ci.orden)
                                         order by ci.orden)
                                  from public.contenido_imagenes as ci
                                 where ci.contenido_id = b.pieza_id
                              ), '[]'::jsonb)
                            end,
            'duracion',    b.pieza_duracion
          )
          order by b.orden, b.dia_offset
        )
        from base as b
        where b.semana = m.semana
          and b.contenido_id is not null
      ), '[]'::jsonb),
      -- frases: los 3 objetos { orden, origen, texto } derivados de
      -- frases_de_etapa para esta semana, ya ordenados por orden. Nuleada
      -- (vaciada) server-side para semanas futuras (DEC-2-2, misma regla que
      -- ya se aplica a recursoRef). Sin fila en frases_por_semana (run-out
      -- del catálogo) → [] via coalesce, nunca null.
      'frases', case
        when m.estado_semana = 'futura' then '[]'::jsonb
        else coalesce(fps.frases, '[]'::jsonb)
      end
    )
    order by m.semana
  ), '[]'::jsonb)
  into v_result
  from marcadas as m
  left join frases_por_semana as fps on fps.semana = m.semana;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. public.paciente_puede_ver_objeto
-- ---------------------------------------------------------------------------

create or replace function public.paciente_puede_ver_objeto(
  p_bucket text,
  p_name   text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with etapa as (
    select et.id, et.fecha_inicio
      from public.etapas_tratamiento as et
      join public.pacientes as p on p.id = et.paciente_id
     where p.user_id = (select auth.uid())
       and et.fecha_finalizacion is null
       and et.fecha_inicio is not null
     order by et.fecha_inicio desc, et.created_at desc
     limit 1
  )
  select exists (
    select 1
      from etapa as e
      join public.entregas_plan as ep on ep.etapa_id = e.id
      join public.contenidos as c on c.id = ep.contenido_id
     where public.entrega_liberada(e.fecha_inicio, ep.dia_offset)
       and (
         (p_bucket = 'contenidos' and c.recurso_ref = p_name)
         or (
           p_bucket = 'contenidos-imagenes'
           and exists (
             select 1
               from public.contenido_imagenes as ci
              where ci.contenido_id = c.id
                and ci.path = p_name
           )
         )
       )
  );
$$;

comment on function public.paciente_puede_ver_objeto(text, text) is
  'Rama "paciente" de las policies de lectura de Storage (buckets contenidos y contenidos-imagenes): true si el usuario actual es un paciente con tratamiento en curso y el objeto (recurso_ref o contenido_imagenes.path) pertenece a una entrega ya liberada de su plan, con la misma regla que get_mi_plan_semanal (public.entrega_liberada). '
  'False para consola, para usuarios sin paciente vinculado y sin sesión. authenticated la ejecuta porque la evalúa la policy; anon no.';

revoke execute on function public.paciente_puede_ver_objeto(text, text) from public, anon;
grant execute on function public.paciente_puede_ver_objeto(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Policies de lectura de los dos buckets
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------

create index if not exists entregas_plan_etapa_id_idx
  on public.entregas_plan using btree (etapa_id);

create index if not exists contenidos_recurso_ref_idx
  on public.contenidos using btree (recurso_ref)
  where recurso_ref is not null;

create index if not exists contenido_imagenes_path_idx
  on public.contenido_imagenes using btree (path);
