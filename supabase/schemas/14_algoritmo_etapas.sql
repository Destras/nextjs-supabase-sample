create table public.algoritmo_etapas (
  algoritmo_id   uuid    not null references public.algoritmos (id),
  numero_etapa   integer not null,
  frase_esperada text    not null,
  primary key (algoritmo_id, numero_etapa)
);

comment on table public.algoritmo_etapas is 'Frases conductuales esperadas por algoritmo según el número de etapa del tratamiento (1 a 4).';

alter table public.algoritmo_etapas enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).
