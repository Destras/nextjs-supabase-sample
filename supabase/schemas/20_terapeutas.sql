create table public.terapeutas (
  id                    uuid        not null primary key references public.profiles (id) on delete cascade,
  matricula             text,
  especialidad          text,
  estado_id             uuid        references public.estados_terapeuta (id),
  activo                boolean     not null default true,
  fecha_cambio_estado   timestamptz,
  motivo_cambio_estado  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  telefono              text
);

comment on table public.terapeutas is 'Perfil extendido del terapeuta; activo=false aplica baja administrativa sin borrar historial clínico.';

alter table public.terapeutas enable row level security;

create trigger set_terapeutas_updated_at
  before update on public.terapeutas
  for each row execute function public.set_updated_at();
