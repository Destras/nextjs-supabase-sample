set check_function_bodies = off;

create or replace function public.handle_terapeuta_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$
;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_terapeuta_email_confirmed();
