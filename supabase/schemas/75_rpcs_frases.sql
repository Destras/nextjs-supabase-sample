-- ---------------------------------------------------------------------------
-- frases_de_etapa
-- ---------------------------------------------------------------------------
-- Regla de derivación de frases motivacionales (D-2 / DEC-0-1), fuente única:
-- dada una etapa, la semana k (1-based) recibe:
--   [causa#(2k-1), algoritmo#k, causa#(2k)]
-- → 3 filas por semana, con orden 1/2/3 y origen 'causa'/'algoritmo'/'causa'.
--
-- Devuelve una RELACIÓN (returns table), no jsonb (DEC-0-1): cada RPC público
-- que la consuma la joinea como una tabla más y arma su propia forma de
-- salida, en vez de tener que desarmar un jsonb.
--
-- Guard de run-out: TODO-O-NADA POR SEMANA (DevSpec §9.5 / DEC-0). Si a una
-- semana le falta CUALQUIERA de sus 3 frases (2k excede las 32 de la causa,
-- O k excede las 16 del algoritmo), esa semana entera devuelve cero filas —
-- nunca 1 o 2 de 3. Repetir frases en silencio sería peor que no mandar
-- ninguna: el terapeuta no se entera. Se logra resolviendo el trío completo
-- de la semana en una sola fila (CTE `trio`, un join por slot) ANTES de
-- desarmarlo en las 3 filas (semana, orden, origen, texto): los tres joins
-- son contra primary keys (causa_id, orden) / (algoritmo_id, orden), así que
-- cada uno matchea a lo sumo una fila -- si cualquiera de los tres no
-- matchea, el inner join elimina la semana completa de "trio", no puede
-- sobrevivir con 1 o 2 de los 3 slots resueltos. Hoy el caso asimétrico es
-- imposible con el catálogo (12 causas × 32, 62 algoritmos × 16, ambos
-- ejes se agotan en la semana 17), pero el guard cubre el caso real.
--
-- Etapa inexistente → semanas_de_etapa devuelve null → generate_series(1, null)
-- no produce filas → relación vacía. No lanza.
--
-- security definer: corre como owner porque etapas_tratamiento/causa_frases/
--   algoritmo_frases tienen RLS que no necesariamente cubre a todo caller.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
--
-- Privada: sin grant a roles externos. No tiene authz propia (deriva frases
-- para CUALQUIER etapa_id que reciba), así que revoca de public Y de
-- authenticated (no solo public): este proyecto tiene un `alter default
-- privileges ... grant execute to authenticated` global (ver
-- derive_alertas_activas en 65_alertas.sql) que de otro modo dejaría a
-- cualquier terapeuta invocarla directo y leer las frases de la etapa de un
-- paciente ajeno, saltándose el authz de get_frases_del_tratamiento_activo.
-- La invoca get_frases_del_tratamiento_activo, que corre como definer.
-- ---------------------------------------------------------------------------

create or replace function public.frases_de_etapa(p_etapa_id uuid)
returns table(semana integer, orden integer, origen text, texto text)
language sql
security definer
stable
set search_path = ''
as $$
  with etapa as (
    -- Causa y algoritmo de la etapa; ambos NOT NULL en etapas_tratamiento,
    -- así que no hay caso "etapa sin algoritmo" que contemplar.
    select e.causa_id, e.algoritmo_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id
  ),
  semanas as (
    -- Serie 1..semanas_de_etapa(p_etapa_id). generate_series con límite null
    -- (etapa inexistente) no produce filas.
    select g.k as semana
      from generate_series(1, public.semanas_de_etapa(p_etapa_id)) as g(k)
  ),
  trio as (
    -- Resuelve las 3 frases de la semana en UNA fila antes de desarmarlas.
    -- Los tres joins son sobre primary key (causa_id, orden) /
    -- (algoritmo_id, orden): cada uno matchea a lo sumo una fila. Si
    -- CUALQUIERA de los tres no matchea, el inner join elimina la semana
    -- entera de `trio` -- todo-o-nada, no hay forma de sobrevivir con 1 o 2
    -- de los 3 slots resueltos.
    select s.semana,
           cf1.texto as texto_causa_1,   -- causa#(2k-1)
           af.texto  as texto_algoritmo, -- algoritmo#k
           cf2.texto as texto_causa_2    -- causa#(2k)
      from semanas as s
      cross join etapa as et
      join public.causa_frases as cf1
        on cf1.causa_id = et.causa_id
       and cf1.orden = 2 * s.semana - 1
      join public.algoritmo_frases as af
        on af.algoritmo_id = et.algoritmo_id
       and af.orden = s.semana
      join public.causa_frases as cf2
        on cf2.causa_id = et.causa_id
       and cf2.orden = 2 * s.semana
  )
  -- Desarma el trío en las 3 filas (semana, orden, origen, texto) que espera
  -- el caller. Cada semana en `trio` ya tiene garantizados sus 3 slots.
  select trio.semana, u.orden, u.origen, u.texto
    from trio
    cross join lateral (
      values (1, 'causa'::text,     trio.texto_causa_1),
             (2, 'algoritmo'::text, trio.texto_algoritmo),
             (3, 'causa'::text,     trio.texto_causa_2)
    ) as u (orden, origen, texto)
   order by trio.semana, u.orden;
$$;

comment on function public.frases_de_etapa(uuid) is
  'Deriva las 3 frases motivacionales de cada semana de una etapa: [causa#(2k-1), algoritmo#k, causa#(2k)] para la semana k. Relación (semana, orden, origen, texto). Todo-o-nada por semana: si a la semana le falta cualquiera de sus 3 frases (catálogo agotado), esa semana devuelve cero filas, no las que sí encontró -- no cicla, no repite, no lanza. Etapa inexistente devuelve relación vacía. Privada: la invoca get_frases_del_tratamiento_activo.';

-- Sin grant: privada (la llama get_frases_del_tratamiento_activo, que corre
-- como definer). anon y authenticated no necesitan acceso directo.
-- Revoca de ambos: `from public` no alcanza por el default privilege global.
revoke execute on function public.frases_de_etapa(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_frases_del_tratamiento_activo
-- ---------------------------------------------------------------------------
-- RPC público que consume el webconsole (D-3 parcial). Resuelve la etapa
-- activa del paciente (fecha_finalizacion IS NULL, mismo criterio que
-- get_mi_plan_semanal), delega en frases_de_etapa y agrupa por semana en
-- jsonb (DEC-0-5), espejando el estilo de get_mi_plan_semanal:
--
--   [ { "semana": 1, "frases": [ { "orden": 1, "origen": "causa", "texto": "…" }, … ] }, … ]
--
-- Paciente sin etapa activa → [] (no lanza: el asignador lo trata como
-- "sin plan").
--
-- Authz — el punto crítico: el terapeuta asignado al paciente (vía la
-- asignación activa, asignaciones_paciente.fecha_hasta IS NULL) o is_admin().
-- La comparación es NULL-safe (`v_terapeuta_id is not null and v_terapeuta_id
-- = auth.uid()`), nunca `auth.uid() = v_terapeuta_id` a secas: con lógica de
-- 3 valores esa forma falla ABIERTO si v_terapeuta_id resuelve a null (bug ya
-- ocurrido en este repo). Sigue el mismo patrón que los RPC de
-- 71_rpcs_pacientes.sql.
--
-- security definer: corre como owner porque las tablas involucradas tienen
--   RLS terapeuta-only.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_frases_del_tratamiento_activo(p_paciente_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
  v_etapa_id     uuid;
  v_result       jsonb;
begin
  -- 1. Resolver el terapeuta dueño vía la asignación activa del paciente.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  -- 2. Autorizar.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() es lo que deja afuera a un terapeuta desactivado con el
  -- token todavía vigente, y nunca devuelve NULL (sin sesión da false). El
  -- `is not null` cierra el otro NULL: si el dueño no resuelve,
  -- `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Resolver la etapa activa del paciente (mismo criterio que
  --    get_mi_plan_semanal: fecha_finalizacion IS NULL, la más reciente).
  select et.id into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  -- Paciente sin etapa activa -> [] (no lanza: el asignador lo trata como
  -- "sin plan").
  if v_etapa_id is null then
    return '[]'::jsonb;
  end if;

  -- 4. Delegar en frases_de_etapa y agrupar por semana (DEC-0-5).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana', semanas.semana,
      'frases', semanas.frases
    )
    order by semanas.semana
  ), '[]'::jsonb)
  into v_result
  from (
    select f.semana,
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
  ) as semanas;

  return v_result;
end;
$$;

comment on function public.get_frases_del_tratamiento_activo(uuid) is
  'Devuelve las frases motivacionales derivadas del tratamiento activo de un paciente, agrupadas por semana ([{ semana, frases: [{ orden, origen, texto }] }]). Paciente sin etapa activa -> []. Acceso: el terapeuta asignado al paciente (asignación activa) o un admin, con comparación NULL-safe.';

grant execute on function public.get_frases_del_tratamiento_activo(uuid) to authenticated;
