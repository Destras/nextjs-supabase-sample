-- FRA-004: frases_de_etapa era todo-o-nada por semana solo por coincidencia
-- (32 = 2×16 en el catálogo), no por diseño. El guard viejo unía tres
-- slots INDEPENDIENTES con `union all`: si a una causa le faltara una frase
-- (o a un algoritmo), esa semana devolvía 1 o 2 filas en vez de []. Esta
-- migración resuelve el trío completo de cada semana en una sola fila (un
-- join por slot, todos sobre primary key) ANTES de desarmarlo en las 3 filas
-- de salida: si cualquiera de los tres joins no matchea, el inner join
-- elimina la semana entera -- todo-o-nada, nunca 2 de 3.
--
-- Hand-written porque `supabase db diff` está roto en este repo. Mismo
-- `create or replace function` + `comment on function` que quedaron en
-- supabase/schemas/75_rpcs_frases.sql. Sin cambios de proconfig ni de
-- grants/revokes (se preservan intactos: security definer, stable,
-- set search_path = '', revoke de public Y de authenticated).

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
