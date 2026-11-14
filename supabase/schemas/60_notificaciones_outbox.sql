create table public.notificaciones_outbox (
  id               uuid        not null default gen_random_uuid() primary key,
  destinatario_id  uuid        not null references public.profiles (id) on delete cascade,
  destinatario_tipo text       not null,
  canal            text        not null,
  tipo             text        not null,
  payload          jsonb,
  programada_para  timestamptz not null,
  estado           text        not null default 'pendiente',
  intentos         integer     not null default 0,
  ultimo_intento   timestamptz,
  ultimo_error     text,
  fecha_envio      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.notificaciones_outbox is 'Cola de outbox para envío confiable de notificaciones externas (push, WhatsApp, email).';

alter table public.notificaciones_outbox enable row level security;

create trigger set_notificaciones_outbox_updated_at
  before update on public.notificaciones_outbox
  for each row execute function public.set_updated_at();
