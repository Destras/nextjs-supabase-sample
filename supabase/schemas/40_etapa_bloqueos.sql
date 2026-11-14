create table public.etapa_bloqueos (
  etapa_id   uuid not null references public.etapas_tratamiento (id),
  bloqueo_id uuid not null references public.bloqueos (id),
  primary key (etapa_id, bloqueo_id)
);

comment on table public.etapa_bloqueos is 'Tabla puente que asocia múltiples bloqueos energéticos a una etapa de tratamiento.';

alter table public.etapa_bloqueos enable row level security;

