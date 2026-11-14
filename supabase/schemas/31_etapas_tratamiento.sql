create table public.etapas_tratamiento (
  id                uuid        not null default gen_random_uuid() primary key,
  paciente_id       uuid        not null references public.pacientes (id),
  terapeuta_id      uuid        not null references public.terapeutas (id),
  causa_id          uuid        not null references public.causas (id),
  algoritmo_id      uuid        not null references public.algoritmos (id),
  modalidad_id      uuid        not null references public.modalidades (id),
  fecha_inicio      date,
  fecha_finalizacion date,
  estado_id         uuid        not null references public.estados_etapa (id),
  motivo_cierre     text,
  notas_diagnostico     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.etapas_tratamiento is 'Entidad clínica central; cada fila es un ciclo de tratamiento completo para un paciente.';

comment on column public.etapas_tratamiento.fecha_inicio is
  'fecha_inicio IS NULL ⟺ la etapa fue creada pero no arrancó; es la única fuente de verdad de "sin iniciar" (per DEC-3 del ProductSpec de inicioTratamiento — el estado pendiente acompaña pero no deriva nada).';

alter table public.etapas_tratamiento enable row level security;

create trigger set_etapas_tratamiento_updated_at
  before update on public.etapas_tratamiento
  for each row execute function public.set_updated_at();

-- Índice de soporte para los lookups por paciente del dashboard admin
-- (get_admin_dashboard_stats / list_terapeutas: etapa activa + niveles por
-- paciente). niveles(etapa_id) ya está cubierto por unique(etapa_id, numero_nivel)
-- y nivel_evaluacion(nivel_id) por su unique.
create index etapas_tratamiento_paciente_id_idx
  on public.etapas_tratamiento (paciente_id);

-- Un paciente tiene a lo sumo UNA etapa abierta (seguridadPanel / SEG-006).
-- "Abierta" = fecha_finalizacion is null: es el criterio que usan
-- get_mi_plan_semanal, iniciar_nueva_etapa, cerrar_etapa, set_entregas_plan y
-- derive_alertas_activas (el estado_id acompaña, no define). Antes solo lo
-- validaba iniciar_nueva_etapa con un `if exists`, que dos llamadas en paralelo
-- pasan las dos. Las etapas cerradas no entran al índice: un paciente puede
-- tener todas las que quiera.
create unique index etapas_tratamiento_una_abierta_por_paciente_idx
  on public.etapas_tratamiento (paciente_id)
  where fecha_finalizacion is null;
