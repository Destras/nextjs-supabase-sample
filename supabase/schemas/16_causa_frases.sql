create table public.causa_frases (
  causa_id uuid    not null references public.causas (id),
  orden    integer not null,
  texto    text    not null,
  primary key (causa_id, orden)
);

comment on table public.causa_frases is 'Catálogo de frases motivacionales derivadas por causa, ordenadas por posición. NO confundir con causa_etapas, que guarda la "frase esperada" (objetivo de evaluación) por etapa de tratamiento.';

alter table public.causa_frases enable row level security;

