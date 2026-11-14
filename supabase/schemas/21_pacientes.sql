create table public.pacientes (
  id                   uuid        not null default gen_random_uuid() primary key,
  user_id              uuid        references auth.users (id),
  nombre               text        not null,
  telefono             text        not null,
  contacto_alternativo text,
  relacion_contacto    text,
  fecha_alta           date,
  estado_id            uuid        references public.estados_paciente (id),
  activo               boolean     not null default true,
  fecha_cambio_estado  timestamptz,
  motivo_cambio_estado text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  email                text        not null,
  fecha_nacimiento     date        not null,
  bienvenida_entregada_at timestamptz
);

comment on table public.pacientes is 'Entidad principal del negocio; nunca se borra físicamente (cumplimiento clínico).';

comment on column public.pacientes.bienvenida_entregada_at is
  'bienvenida_entregada_at IS NULL ⟺ el paciente nunca recibió el mensaje único de bienvenida post-activación (activacionPorTelefono, Epic 3); paciente-invitacion la setea una sola vez cuando la entrega — nunca vuelve a NULL.';

alter table public.pacientes enable row level security;

alter table public.pacientes
  add constraint pacientes_telefono_canonico_check check (telefono ~ '^\+54[1-8][0-9]{9}$');

create trigger set_pacientes_updated_at
  before update on public.pacientes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- normalizar_telefono_paciente (trigger function)
-- ---------------------------------------------------------------------------
-- Aplica public.normalizar_telefono_ar (ADR-0008, fuente única) antes de
-- cada insert/update de telefono. Si el valor entrante llega vacío/whitespace,
-- lo colapsa a NULL (no a '') para que el `not null` de la columna dispare
-- 23502 — el mismo camino que el guard telefono_requerido de
-- register_paciente / update_paciente_identidad, que ya corre antes del
-- insert/update y da ese error primero en el flujo normal de la app; este
-- trigger es la red de contención para cualquier escritura directa a la
-- tabla que no pase por esos RPCs (seeds, psql, futuras funciones). Si el
-- valor no es vacío pero no normaliza a un teléfono argentino válido, falla
-- con telefono_invalido (23514).
-- ---------------------------------------------------------------------------

create or replace function public.normalizar_telefono_paciente()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.telefono is null or btrim(new.telefono) = '' then
    new.telefono := null;
    return new;
  end if;

  new.telefono := public.normalizar_telefono_ar(new.telefono);

  if new.telefono is null then
    raise exception 'telefono_invalido' using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.normalizar_telefono_paciente is 'Trigger helper: normaliza pacientes.telefono a su forma canónica (public.normalizar_telefono_ar) antes de cada insert/update. Un valor vacío/whitespace colapsa a NULL (dispara el not null de la columna, 23502); un valor no vacío que no normaliza lanza telefono_invalido (23514).';

-- Función de trigger: no la llama nadie directo (seguridadPanel / SEG-005).
revoke execute on function public.normalizar_telefono_paciente() from public, anon, authenticated;

create trigger normalizar_telefono_pacientes
  before insert or update of telefono on public.pacientes
  for each row execute function public.normalizar_telefono_paciente();

create unique index pacientes_user_id_key on public.pacientes (user_id) where user_id is not null;
create unique index pacientes_email_key on public.pacientes (email);
create index pacientes_telefono_idx on public.pacientes (telefono);
