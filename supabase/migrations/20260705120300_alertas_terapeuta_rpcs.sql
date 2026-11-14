-- ---------------------------------------------------------------------------
-- list_alertas_terapeuta
-- ---------------------------------------------------------------------------
-- Alertas activas del caseload propio: filtra derive_alertas_activas() por
-- terapeuta_id = auth.uid(). El scoping por auth.uid() ES el enforcement (un
-- terapeuta nunca ve alertas de otro). Devuelve las 8 columnas del motor,
-- incluyendo terapeuta_nombre (el propio nombre del terapeuta) para matchear
-- la forma que espera el mapper compartido mapAlertaRow en toda fila.
create or replace function public.list_alertas_terapeuta()
returns table (
  paciente_id      uuid,
  paciente_nombre  text,
  terapeuta_id     uuid,
  terapeuta_nombre text,
  tipo             text,
  evento_ref       text,
  valor            int,
  fecha            timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select d.paciente_id,
         d.paciente_nombre,
         d.terapeuta_id,
         d.terapeuta_nombre,
         d.tipo,
         d.evento_ref,
         d.valor,
         d.fecha
    from public.derive_alertas_activas() d
   where d.terapeuta_id = auth.uid();
$$;

comment on function public.list_alertas_terapeuta is
  'Alertas activas del caseload propio del terapeuta autenticado: filtra derive_alertas_activas() por terapeuta_id = auth.uid(). El scoping ES el enforcement. Devuelve las 8 columnas del motor (incluye terapeuta_nombre, el propio nombre, para matchear la forma que espera mapAlertaRow).';

grant execute on function public.list_alertas_terapeuta() to authenticated;

-- ---------------------------------------------------------------------------
-- marcar_alerta_atendida
-- ---------------------------------------------------------------------------
-- Marca una alerta derivada como atendida (dismissal). Guard null-safe: solo
-- el terapeuta dueño de la asignación activa del paciente puede marcar — el
-- admin NO marca (has_active_assignment cierra el caso NULL: fail-closed ante
-- lógica de 3 valores, auth.uid() = null nunca matchea). Idempotente via
-- unique(tipo, evento_ref, paciente_id) + on conflict do nothing (doble click
-- / race no falla ni duplica). p_tipo son los 4 tipos del MVP de este repo
-- (sin `reinicio`, diferido a feat/nuevo-tratamiento — ver derive_alertas_activas
-- en 65_alertas.sql).
create or replace function public.marcar_alerta_atendida(
  p_tipo        text,
  p_evento_ref  text,
  p_paciente_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_tipo not in ('score_bajo', 'eval_vencida', 'mes_3', 'fin') then
    raise exception 'tipo_invalido' using errcode = '23514';
  end if;

  select a.terapeuta_id
    into v_terapeuta_id
    from public.asignaciones_paciente a
   where a.paciente_id = p_paciente_id
     and a.fecha_hasta is null;

  insert into public.alertas_atendidas (tipo, evento_ref, paciente_id, terapeuta_id, atendida_por)
  values (p_tipo, p_evento_ref, p_paciente_id, v_terapeuta_id, auth.uid())
  on conflict (tipo, evento_ref, paciente_id) do nothing;
end;
$$;

comment on function public.marcar_alerta_atendida(text, text, uuid) is
  'Marca una alerta derivada (tipo, evento_ref) como atendida para el paciente dado. Guard null-safe: has_active_assignment(p_paciente_id) — solo el terapeuta dueño, el admin no marca. terapeuta_id se resuelve del asignado activo del paciente. Idempotente: unique(tipo, evento_ref, paciente_id) + on conflict do nothing. p_tipo valida contra los 4 tipos del MVP (sin reinicio).';

grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- desmarcar_alerta_atendida
-- ---------------------------------------------------------------------------
-- Undo de marcar_alerta_atendida: borra el dismissal, la alerta vuelve a
-- aparecer en list_alertas_terapeuta. Mismo guard null-safe. Idempotente:
-- borrar algo inexistente no falla.
create or replace function public.desmarcar_alerta_atendida(
  p_tipo        text,
  p_evento_ref  text,
  p_paciente_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  delete from public.alertas_atendidas
   where tipo = p_tipo
     and evento_ref = p_evento_ref
     and paciente_id = p_paciente_id;
end;
$$;

comment on function public.desmarcar_alerta_atendida(text, text, uuid) is
  'Undo de marcar_alerta_atendida: borra el dismissal (tipo, evento_ref), la alerta vuelve a aparecer en list_alertas_terapeuta. Mismo guard null-safe has_active_assignment. Idempotente: borrar algo inexistente no falla. Habilita el "deshacer" del toast.';

grant execute on function public.desmarcar_alerta_atendida(text, text, uuid) to authenticated;
