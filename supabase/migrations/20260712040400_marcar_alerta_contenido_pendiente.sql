-- Amplía marcar_alerta_atendida para aceptar el 6º tipo, contenido_pendiente
-- (feat/inicio-tratamiento, Task 2.2), emitido por derive_alertas_activas
-- desde la Task 2.1. Sin este cambio, marcar la alerta como atendida falla
-- con tipo_invalido (23514) — la FK alertas_atendidas.tipo → tipos_alerta
-- ya está satisfecha por el insert de catálogo de la Task 0.1.
--
-- `db diff` está roto en este ambiente (bug de ordering de is_admin) — esta
-- migración fue hand-authored con el cuerpo COMPLETO de la función, en sync
-- con supabase/schemas/66_alertas_terapeuta.sql.
--
-- create or replace re-agrega el grant global de EXECUTE (PUBLIC) — acá no
-- es crítico: el grant a `authenticated` de abajo es el comportamiento
-- previsto (no un bypass de security definer como en derive_alertas_activas).
-- El guard null-safe has_active_assignment(p_paciente_id) se preserva sin
-- cambios: solo el terapeuta dueño de la asignación activa marca, el admin
-- no.
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

  if p_tipo not in ('score_bajo', 'eval_vencida', 'mes_3', 'fin', 'reinicio', 'contenido_pendiente') then
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
  'Marca una alerta derivada (tipo, evento_ref) como atendida para el paciente dado. Guard null-safe: has_active_assignment(p_paciente_id) — solo el terapeuta dueño, el admin no marca. terapeuta_id se resuelve del asignado activo del paciente. Idempotente: unique(tipo, evento_ref, paciente_id) + on conflict do nothing. p_tipo valida contra los 6 tipos vigentes (incluye reinicio, feat/nuevo-tratamiento, y contenido_pendiente, feat/inicio-tratamiento).';

grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;
