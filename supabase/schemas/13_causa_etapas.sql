create table public.causa_etapas (
  causa_id       uuid    not null references public.causas (id),
  numero_etapa   integer not null,
  frase_esperada text    not null,
  primary key (causa_id, numero_etapa)
);

comment on table public.causa_etapas is 'Frases emocionales esperadas por causa según el número de etapa del tratamiento (1 a 4).';

alter table public.causa_etapas enable row level security;

-- Políticas RLS: documentadas en docs/rls/ (el SQL de políticas no se publica en este repo).
