-- ---------------------------------------------------------------------------
-- mediciones_estructura
-- ---------------------------------------------------------------------------
-- Cabecera de una lectura de estructura de un paciente en una etapa de
-- tratamiento. `momento` clasifica la lectura: 'apertura' (primera de la
-- etapa), 'seguimiento' (cualquiera intermedia), 'cierre' (registrada junto
-- con el cierre de la etapa via cerrar_etapa_con_medicion) o
-- 'cierre_automatico' (copia generada por _generar_cierre_automatico cuando
-- la etapa se cierra por otra vía sin que el terapeuta haya medido).
--
-- `registrada_por` es null exclusivamente en 'cierre_automatico' — no hay un
-- terapeuta detrás de esa fila, la generó el sistema. `copiada_de` apunta a
-- la medición real que el cierre automático clonó; NO tiene `on delete`
-- (NO ACTION, chequeado al final del statement, no antes) — ver
-- .docs/manualtesting/uat-teardown.sql Nivel 3.5 para el gotcha que esto
-- implica al borrar en cascada manual.
--
-- Invariantes (design §2, §8.1): a lo sumo una 'apertura' y a lo sumo una
-- fila entre 'cierre'/'cierre_automatico' por etapa — impuesto por los dos
-- índices únicos parciales de abajo, no por la aplicación. `estructura_general`
-- y cada medicion_valores.valor están acotados 0-100 por check constraint,
-- reforzando (no reemplazando) la validación de _validar_valores_medicion.
-- ---------------------------------------------------------------------------

create table public.mediciones_estructura (
  id                  uuid        not null default gen_random_uuid() primary key,
  etapa_id            uuid        not null references public.etapas_tratamiento (id),
  momento             text        not null check (
    momento in ('apertura', 'seguimiento', 'cierre', 'cierre_automatico')
  ),
  estructura_general  int         not null check (estructura_general between 0 and 100),
  registrada_en       timestamptz not null default now(),
  registrada_por      uuid        references public.profiles (id),
  copiada_de          uuid        references public.mediciones_estructura (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.mediciones_estructura is
  'Cabecera de una lectura de estructura energética de un paciente en una etapa de tratamiento. momento: apertura|seguimiento|cierre|cierre_automatico. registrada_por es null solo en cierre_automatico (fila generada por el sistema, sin autor). copiada_de referencia la medición real que un cierre_automatico clonó.';

comment on column public.mediciones_estructura.registrada_por is
  'null exclusivamente cuando momento = cierre_automatico: la fila la generó _generar_cierre_automatico, no un terapeuta.';

comment on column public.mediciones_estructura.copiada_de is
  'Solo poblado en cierre_automatico: la medición real (apertura/seguimiento/cierre) cuyos valores se clonaron. Self-FK sin on delete (NO ACTION, chequeada al final del statement).';

alter table public.mediciones_estructura enable row level security;

create trigger set_mediciones_estructura_updated_at
  before update on public.mediciones_estructura
  for each row execute function public.set_updated_at();

-- Invariantes de unicidad — a lo sumo una apertura y a lo sumo un cierre
-- (real o automático) por etapa. Parciales porque el resto de los momentos
-- ('seguimiento') no tiene tope.
create unique index mediciones_estructura_apertura_unica_idx
  on public.mediciones_estructura (etapa_id)
  where momento = 'apertura';

create unique index mediciones_estructura_cierre_unico_idx
  on public.mediciones_estructura (etapa_id)
  where momento in ('cierre', 'cierre_automatico');

-- Índice de soporte: toda lectura del contrato (get_estructura_paciente,
-- _generar_cierre_automatico, _medicion_editable) filtra/ordena por etapa_id.
create index mediciones_estructura_etapa_id_idx
  on public.mediciones_estructura (etapa_id);

-- Table-level grants — mismo hallazgo que 45_centros_energeticos.sql: sin
-- grant select explícito la policy de arriba nunca se alcanza (falta el
-- privilegio de tabla de base), y `authenticated` hereda TRUNCATE/TRIGGER a
-- menos que se revoque explícito acá (00_authenticated_lockdown.sql declara
-- el revoke solo del lado de supabase/schemas/, nunca corrió como migración
-- real contra la base — test de privilegios no incluido en este repo).
grant select on table public.mediciones_estructura to authenticated;
revoke truncate, trigger on table public.mediciones_estructura from authenticated;

-- Defensa en profundidad más allá de RLS (no hay policy de escritura para
-- ningún rol, design §8.1: las tres RPCs de escritura corren security
-- definer y no dependen de este grant): sin este revoke, un
-- INSERT/UPDATE/DELETE de authenticated fallaría solo porque falta policy
-- que lo permita — un detalle frágil de RLS, no un control real. Mismo
-- patrón que documentos_legales (23_documentos_legales.sql).
revoke insert, update, delete on table public.mediciones_estructura from authenticated;
