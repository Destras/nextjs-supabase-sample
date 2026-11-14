-- Mirrors supabase/schemas/45_centros_energeticos.sql,
-- supabase/schemas/46_mediciones_estructura.sql,
-- supabase/schemas/47_medicion_valores.sql — DDL only.
--
-- Hand-authored (not `supabase db diff`): este repo tiene `supabase db diff`
-- roto de cero contra supabase/schemas/ (is_admin ordering,
-- .claude/supabase-declarative-database-schema.md "Known caveats"), y aun si
-- funcionara, migra no captura policies de RLS creadas solo en la migración
-- (las dropea en silencio), ni EXECUTE grants, ni comments. Todo eso se
-- declara acá a mano, exactamente como en los tres archivos de schemas/.
--
-- sdd/medir-chakras PR1 (E0: Database & Security Foundation), design §2 M1.

-- ---------------------------------------------------------------------------
-- centros_energeticos
-- ---------------------------------------------------------------------------

create table public.centros_energeticos (
  id                uuid        not null default gen_random_uuid() primary key,
  codigo            text        not null unique,
  nombre            text        not null,
  etiqueta_paciente text        not null,
  orden             int         not null unique,
  activo            boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.centros_energeticos is
  'Catálogo de referencia de los 12 centros energéticos medibles (medirChakras). No dispara nada por sí solo. activo permite desactivar un centro sin borrar su historial: medicion_valores nunca reinterpreta el catálogo, una medición vieja conserva el centro que midió aunque se desactive después.';

comment on column public.centros_energeticos.etiqueta_paciente is
  'Wording orientado al paciente (OD-4, abierta): arranca igual a nombre.';

comment on column public.centros_energeticos.orden is
  'Orden de catálogo: el que usan el formulario de medición y la matriz de Historia.';

alter table public.centros_energeticos enable row level security;

create trigger set_centros_energeticos_updated_at
  before update on public.centros_energeticos
  for each row execute function public.set_updated_at();

grant select on table public.centros_energeticos to authenticated;
revoke truncate, trigger on table public.centros_energeticos from authenticated;

-- ---------------------------------------------------------------------------
-- mediciones_estructura
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

create unique index mediciones_estructura_apertura_unica_idx
  on public.mediciones_estructura (etapa_id)
  where momento = 'apertura';

create unique index mediciones_estructura_cierre_unico_idx
  on public.mediciones_estructura (etapa_id)
  where momento in ('cierre', 'cierre_automatico');

create index mediciones_estructura_etapa_id_idx
  on public.mediciones_estructura (etapa_id);

grant select on table public.mediciones_estructura to authenticated;
revoke truncate, trigger on table public.mediciones_estructura from authenticated;

-- ---------------------------------------------------------------------------
-- medicion_valores
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

create index medicion_valores_medicion_id_idx
  on public.medicion_valores (medicion_id);

grant select on table public.medicion_valores to authenticated;
revoke truncate, trigger on table public.medicion_valores from authenticated;
