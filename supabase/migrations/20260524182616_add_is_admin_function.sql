set check_function_bodies = off;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.roles    r on r.id = p.rol_id
     where p.id      = p_user_id
       and r.codigo  = 'admin'
  );
$$;

comment on function public.is_admin is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin". Usada como guarda en RPCs admin-only.';
