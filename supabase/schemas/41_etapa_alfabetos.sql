create table public.etapa_alfabetos (
  etapa_id    uuid not null references public.etapas_tratamiento (id),
  alfabeto_id uuid not null references public.alfabetos (id),
  numero      smallint not null check (numero >= 1),
  primary key (etapa_id, alfabeto_id, numero)
);

comment on table public.etapa_alfabetos is 'Tabla puente que registra qué alfabetos y qué números de cada alfabeto se aplicaron en cada etapa de tratamiento: una fila por número (ADR 0015).';

alter table public.etapa_alfabetos enable row level security;

-- Valida el rango del número contra el catálogo (alfabetos.rango_max). Es
-- security definer para leer el catálogo sin depender de RLS ni de grants del
-- que escribe. No lleva grant: PostgreSQL no chequea EXECUTE al disparar un
-- trigger. El nulo pasa a propósito: lo rechaza el not null (23502). El 0 lo
-- rechaza este trigger antes que el check, porque un trigger before corre antes
-- que los constraints.
create or replace function public.validar_numero_alfabeto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rango_max smallint;
  v_codigo    text;
begin
  select a.rango_max, a.codigo
    into v_rango_max, v_codigo
    from public.alfabetos as a
   where a.id = new.alfabeto_id;

  if new.numero is not null and (new.numero < 1 or new.numero > v_rango_max) then
    raise exception 'alfabeto_numero_fuera_de_rango'
      using errcode = 'P0001',
            detail = format('%s admite del 1 al %s', v_codigo, v_rango_max);
  end if;

  return new;
end;
$$;

comment on function public.validar_numero_alfabeto() is
  'Trigger: rechaza con alfabeto_numero_fuera_de_rango (P0001) un número fuera de 1..alfabetos.rango_max. El nulo lo rechaza el not null de etapa_alfabetos.numero.';

create trigger validar_numero_alfabeto_trg
  before insert or update on public.etapa_alfabetos
  for each row execute function public.validar_numero_alfabeto();
