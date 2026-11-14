create table public.otps_activacion (
  id               uuid        not null default gen_random_uuid() primary key,
  paciente_id      uuid        not null references public.pacientes (id) on delete cascade,
  otp_hash         text        not null,
  estado           text        not null default 'active' check (estado in ('active', 'used', 'blocked', 'superseded')),
  purpose          text        not null default 'activation' check (purpose in ('activation', 'cambio_password')),
  expires_at       timestamptz not null,
  failed_attempts  int         not null default 0,
  used_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  delivered_at     timestamptz
);

comment on table public.otps_activacion is 'Códigos de activación OTP hasheados (HMAC-SHA256 + pepper en Vault). RLS lockdown total: solo security definer y service-role pueden acceder. Un único OTP active por paciente y hash único global entre activos. delivered_at (null = nunca entregado) marca cuándo se entregó el código al paciente por WhatsApp; lo setea marcar_otp_entregado y lo usa solicitar_otp_activacion para el tope diario (activacionPorTelefono, Epic 1). Pese al nombre guarda TODOS los OTP del paciente: purpose distingue activation de cambio_password (ADR-0013); toda lectura filtra por purpose y los límites (cooldown, bloqueo, tope diario) cuentan por paciente sin mirarlo.';

alter table public.otps_activacion enable row level security;

create trigger set_otps_activacion_updated_at
  before update on public.otps_activacion
  for each row execute function public.set_updated_at();

-- Lookup por hash en validate/create-account
create index otps_activacion_otp_hash_idx on public.otps_activacion (otp_hash);

-- Un único OTP active por paciente (RF-MOB-007)
create unique index otps_activacion_unico_activo_idx on public.otps_activacion (paciente_id) where estado = 'active';

-- Unicidad global del hash activo: validar_otp resuelve exactamente un paciente por hash (DEC-E0-6)
create unique index otps_activacion_hash_activo_idx on public.otps_activacion (otp_hash) where estado = 'active';

-- Tope diario de solicitar_otp_activacion (activacionPorTelefono, Epic 1): ventana móvil de
-- 24h sobre delivered_at por paciente.
create index otps_activacion_paciente_entrega_idx on public.otps_activacion (paciente_id, delivered_at);
