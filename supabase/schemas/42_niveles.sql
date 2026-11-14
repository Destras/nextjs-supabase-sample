create table public.niveles (
  id                        uuid        not null default gen_random_uuid() primary key,
  etapa_id                  uuid        not null references public.etapas_tratamiento (id),
  numero_nivel              integer     not null,
  fecha_seguimiento_esperada date,
  fecha_seguimiento_real     date,
  observaciones              text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (etapa_id, numero_nivel)
);

comment on table public.niveles is 'Hitos mensuales de seguimiento dentro de una etapa de tratamiento.';

alter table public.niveles enable row level security;

create trigger set_niveles_updated_at
  before update on public.niveles
  for each row execute function public.set_updated_at();

