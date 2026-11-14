create table public.algoritmo_frases (
  algoritmo_id uuid    not null references public.algoritmos (id),
  orden        integer not null,
  texto        text    not null,
  primary key (algoritmo_id, orden)
);

comment on table public.algoritmo_frases is 'Catálogo de frases motivacionales derivadas por algoritmo, ordenadas por posición. NO confundir con algoritmo_etapas, que guarda la "frase esperada" (objetivo de evaluación) por etapa de tratamiento.';

alter table public.algoritmo_frases enable row level security;

