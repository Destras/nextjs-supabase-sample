create table public.nivel_evaluacion (
  id               uuid        not null default gen_random_uuid() primary key,
  nivel_id         uuid        not null unique references public.niveles (id),
  score            numeric(2,1) not null check (score between 1 and 5),
  fecha_respuesta  timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.nivel_evaluacion is 'Autoevaluación del paciente en cada hito de nivel (score del 1 al 5).';

alter table public.nivel_evaluacion enable row level security;

create trigger set_nivel_evaluacion_updated_at
  before update on public.nivel_evaluacion
  for each row execute function public.set_updated_at();

