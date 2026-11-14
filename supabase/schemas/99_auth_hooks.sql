create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

comment on function public.handle_new_user is 'Auth trigger: crea fila en public.profiles cuando se da de alta un usuario en auth.users.';

-- Función de trigger: no la llama nadie directo (seguridadPanel / SEG-005).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_terapeuta_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.terapeutas
       set estado_id            = (select id from public.estados_terapeuta where codigo = 'activo'),
           activo               = true,
           fecha_cambio_estado  = now()
     where id = new.id
       and estado_id = (select id from public.estados_terapeuta where codigo = 'pendiente');
  end if;
  return new;
end;
$$;

comment on function public.handle_terapeuta_email_confirmed is
  'Auth trigger: promueve a un terapeuta de estado pendiente a activo cuando confirma su email.';

-- Función de trigger: no la llama nadie directo (seguridadPanel / SEG-005).
revoke execute on function public.handle_terapeuta_email_confirmed() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_terapeuta_email_confirmed();
