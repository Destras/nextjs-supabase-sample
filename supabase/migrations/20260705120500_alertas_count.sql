-- ---------------------------------------------------------------------------
-- count_alertas_terapeuta
-- ---------------------------------------------------------------------------
-- RPC liviano para la campana de acceso global (Epic 3): devuelve solo el
-- entero de alertas activas del caseload propio, sin traer la lista completa
-- (la campana vive en todas las páginas, así que el payload debe ser chico).
-- El count es personal para todos los roles: el admin, tratado como
-- terapeuta, cuenta su propio caseload. No existe count_alertas_admin — la
-- supervisión de la red sale de la columna de /terapeutas (Epic 2), no de la
-- campana.
create or replace function public.count_alertas_terapeuta()
returns int
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
    from public.derive_alertas_activas()
   where terapeuta_id = auth.uid();
$$;

comment on function public.count_alertas_terapeuta is
  'Cuenta las alertas activas del caseload propio del terapeuta autenticado (personal para todos los roles, incluido el admin). Payload chico para la campana de acceso global — no trae la lista, solo el entero. No hay count_alertas_admin: la supervisión de la red sale de /terapeutas (Epic 2).';

grant execute on function public.count_alertas_terapeuta() to authenticated;
