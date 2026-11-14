-- otps_activacion: tabla de códigos OTP de activación de pacientes.
--
-- Nota: comment on table no es capturado por supabase db diff (caveat conocido
-- de migra) → se incluye manualmente en esta migración.
--
-- Nota: enable row level security, el trigger set_otps_activacion_updated_at y
-- los tres índices SÍ son capturados por migra para tablas nuevas, pero se
-- incluyen explícitamente aquí per DEC-E0-3 y la memoria de proyecto
-- db-diff-drops-migration-only-rls-policies para garantizar que no se pierdan.
--
-- RLS lockdown total (DEC-E0-3): RLS on + sin policies = deny-all para
-- authenticated. anon ya está bloqueado globalmente por 00_anon_lockdown.sql.
-- La tabla solo la tocan funciones security definer y el service-role.

create table public.otps_activacion (
  id              uuid        not null default gen_random_uuid() primary key,
  paciente_id     uuid        not null references public.pacientes (id) on delete cascade,
  otp_hash        text        not null,
  estado          text        not null default 'active' check (estado in ('active', 'used', 'blocked', 'superseded')),
  purpose         text        not null default 'activation' check (purpose in ('activation', 'recovery')),
  expires_at      timestamptz not null,
  failed_attempts int         not null default 0,
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.otps_activacion is 'Códigos de activación OTP hasheados (HMAC-SHA256 + pepper en Vault). RLS lockdown total: solo security definer y service-role pueden acceder. Un único OTP active por paciente y hash único global entre activos.';

-- RLS lockdown: deny-all para authenticated; anon bloqueado globalmente.
-- Ninguna policy: solo funciones security definer y service-role acceden.
alter table public.otps_activacion enable row level security;

-- Trigger: mantiene updated_at en cada UPDATE (patrón compartido).
create trigger set_otps_activacion_updated_at
  before update on public.otps_activacion
  for each row execute function public.set_updated_at();

-- Índice 1: lookup por otp_hash en validate/create-account.
create index otps_activacion_otp_hash_idx on public.otps_activacion (otp_hash);

-- Índice 2: un único OTP active por paciente (RF-MOB-007).
create unique index otps_activacion_unico_activo_idx on public.otps_activacion (paciente_id) where estado = 'active';

-- Índice 3: unicidad global del hash activo — validar_otp resuelve exactamente
-- un paciente por hash; la DOB es segundo factor confirmatorio, no desambiguador
-- (DEC-E0-6). Red atómica contra colisiones de código entre pacientes.
create unique index otps_activacion_hash_activo_idx on public.otps_activacion (otp_hash) where estado = 'active';
