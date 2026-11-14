-- ---------------------------------------------------------------------------
-- medicion_valores
-- ---------------------------------------------------------------------------
-- Detalle por centro de una mediciones_estructura: un valor 0-100 por centro
-- energético incluido en esa lectura. `centro_id` NUNCA reinterpreta el
-- catálogo (design §1.5/§8.1): una fila conserva el centro que se midió aun
-- si ese centro se desactiva más tarde en centros_energeticos — es el read
-- path (get_estructura_paciente) el que denormaliza codigo/nombre/orden/activo
-- al momento de leer, no esta tabla al momento de escribir.
--
-- Sin unique(medicion_id, centro_id): la ausencia de duplicados por centro
-- dentro de una medición la garantiza _validar_valores_medicion (design §1.1,
-- paso 5) antes de insertar — design M1 acota este archivo a los dos índices
-- btree/parciales de mediciones_estructura más este único btree de soporte,
-- no agrega una unicidad redundante a nivel de constraint.
-- ---------------------------------------------------------------------------

create table public.medicion_valores (
  id           uuid        not null default gen_random_uuid() primary key,
  medicion_id  uuid        not null references public.mediciones_estructura (id),
  centro_id    uuid        not null references public.centros_energeticos (id),
  valor        int         not null check (valor between 0 and 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.medicion_valores is
  'Detalle por centro de una mediciones_estructura: un valor 0-100 por centro energético incluido en esa lectura. centro_id nunca reinterpreta el catálogo — conserva el centro medido aunque se desactive después; el read path denormaliza codigo/nombre/orden/activo al leer.';

alter table public.medicion_valores enable row level security;

create trigger set_medicion_valores_updated_at
  before update on public.medicion_valores
  for each row execute function public.set_updated_at();

-- Índice de soporte: toda lectura del contrato agrupa los valores por
-- medición (get_estructura_paciente) y editar_medicion actualiza en el
-- mismo predicado.
create index medicion_valores_medicion_id_idx
  on public.medicion_valores (medicion_id);

-- Table-level grants — mismo hallazgo que 45_centros_energeticos.sql y
-- 46_mediciones_estructura.sql.
grant select on table public.medicion_valores to authenticated;
revoke truncate, trigger on table public.medicion_valores from authenticated;

-- Defensa en profundidad más allá de RLS (no hay policy de escritura para
-- ningún rol, design §8.1): sin este revoke, un INSERT/UPDATE/DELETE de
-- authenticated fallaría solo porque falta policy que lo permita — un
-- detalle frágil de RLS, no un control real. Mismo patrón que
-- documentos_legales (23_documentos_legales.sql).
revoke insert, update, delete on table public.medicion_valores from authenticated;
