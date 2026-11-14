create table public.asignaciones_paciente (
  id           uuid        not null default gen_random_uuid() primary key,
  paciente_id  uuid        not null references public.pacientes (id),
  terapeuta_id uuid        not null references public.terapeutas (id),
  fecha_desde  date        not null,
  fecha_hasta  date,
  motivo       text,
  asignado_por uuid        references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index asignaciones_paciente_activa_idx
  on public.asignaciones_paciente (paciente_id)
  where fecha_hasta is null;

comment on table public.asignaciones_paciente is 'Historial de asignaciones terapeuta-paciente; solo una asignación activa por paciente (fecha_hasta IS NULL).';

alter table public.asignaciones_paciente enable row level security;

create trigger set_asignaciones_paciente_updated_at
  before update on public.asignaciones_paciente
  for each row execute function public.set_updated_at();

