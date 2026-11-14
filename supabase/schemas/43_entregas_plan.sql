create table public.entregas_plan (
  id               uuid        not null default gen_random_uuid() primary key,
  etapa_id         uuid        not null references public.etapas_tratamiento (id),
  dia_offset       integer     not null,
  contenido_id     uuid        not null references public.contenidos (id),
  orden            integer     not null,
  fecha_entregada  timestamptz,
  fecha_consumida  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.entregas_plan is 'Plan real del paciente: cada fila es una pieza de contenido (video/audio) entregable por semana. La frase de la semana ya no vive acá (frasesAutomaticas): se deriva de la causa/algoritmo de la etapa.';

alter table public.entregas_plan enable row level security;

create trigger set_entregas_plan_updated_at
  before update on public.entregas_plan
  for each row execute function public.set_updated_at();

-- La policy de lectura de Storage (paciente_puede_ver_objeto, SEG-002) y
-- get_mi_plan_semanal buscan las entregas de una etapa.
create index entregas_plan_etapa_id_idx
  on public.entregas_plan using btree (etapa_id);
