-- Reincorpora el tipo `reinicio` al subsistema de alertas (DEC-33,
-- feat/nuevo-tratamiento): agrega el tercer nivel de prioridad `baja` al
-- catálogo tipos_alerta, inserta la fila de presentación del tipo `reinicio`,
-- y amplía la whitelist de marcar_alerta_atendida para que sea marcable como
-- las demás.
--
-- `db diff` está roto en este ambiente (bug de ordering de is_admin) — esta
-- migración fue hand-authored. Postgres no permite alterar un check
-- constraint in place: se dropea y se re-crea con el set ampliado.
alter table public.tipos_alerta
  drop constraint tipos_alerta_prioridad_check;

alter table public.tipos_alerta
  add constraint tipos_alerta_prioridad_check
  check (prioridad in ('alta', 'media', 'baja'));

insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono) values
  ('reinicio', 'Reinicio de tratamiento', 'baja', 5, '↻')
on conflict (codigo) do nothing;

-- Amplía marcar_alerta_atendida para aceptar `reinicio` (antes limitado a los
-- 4 tipos del MVP). create or replace re-agrega el grant global de EXECUTE
-- (PUBLIC) — no crítico acá porque el grant a `authenticated` de abajo es el
-- previsto (no security definer bypass como en derive_alertas_activas).
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

  if p_tipo not in ('score_bajo', 'eval_vencida', 'mes_3', 'fin', 'reinicio') then
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
  'Marca una alerta derivada (tipo, evento_ref) como atendida para el paciente dado. Guard null-safe: has_active_assignment(p_paciente_id) — solo el terapeuta dueño, el admin no marca. terapeuta_id se resuelve del asignado activo del paciente. Idempotente: unique(tipo, evento_ref, paciente_id) + on conflict do nothing. p_tipo valida contra los 5 tipos vigentes (incluye reinicio, feat/nuevo-tratamiento).';

grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;
