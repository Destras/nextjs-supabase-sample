-- pulidoBeta / BETA-030 — el email de la ficha no se puede cambiar una vez que el
-- paciente activó su cuenta.
--
-- Término "Email de la ficha" y "Activación" (CONTEXT.md): la activación termina
-- cuando pacientes.user_id queda vinculado, y en ese momento el email de la ficha
-- pasa a auth.users (una sola vez). update_paciente_identidad escribía
-- `email = btrim(p_email)` sin mirar user_id: si el terapeuta editaba el email de
-- un paciente ya activado, la ficha mostraba el nuevo y el paciente seguía
-- entrando con el viejo, sin ningún aviso.
--
-- Decisión del usuario (2026-10-05): se bloquea. Sincronizar el login queda
-- descartado (un terapeuta le cambiaría el acceso al paciente sin que intervenga).
--
-- Qué cambia:
--   * Guard nuevo, después de las validaciones de requeridos y antes del update:
--     con user_id no nulo y un p_email distinto del guardado (sin contar
--     mayúsculas ni espacios) lanza `email_bloqueado_por_cuenta` (P0001).
--   * El update conserva el email guardado cuando la fila tiene user_id: reenviar
--     el mismo email con otras mayúsculas no lo pisa.
--   * El comment de la función menciona el error nuevo.
--
-- Qué NO cambia: firma, returns void, security definer, search_path, la authz
-- (terapeuta de la asignación activa o admin, NULL-safe), las validaciones
-- existentes ni el grant a authenticated. Sin user_id el email se edita igual.
--
-- No corrige las fichas que ya estaban desincronizadas: eso se revisa a mano
-- (ver "Pasos manuales en producción" en .docs/features/pulidoBeta/STATE.md).
--
-- Escrita a mano (`db diff` no corre en este repo). El cuerpo espeja
-- supabase/schemas/71_rpcs_pacientes.sql.

create or replace function public.update_paciente_identidad(
  p_paciente_id          uuid,
  p_nombre               text,
  p_fecha_nacimiento     date,
  p_email                text,
  p_telefono             text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  -- 1. Resolver el terapeuta dueño y autorizar. Preferimos la asignación
  --    activa; si no hay (hueco de datos), caemos a la etapa activa, igual que
  --    update_etapa_diagnostico, para no bloquear datos siempre editables.
  --    order by coalesce(fecha_inicio, created_at) desc (no fecha_inicio desc
  --    a secas): en Postgres `desc` es NULLS FIRST, así que una etapa sin
  --    arrancar (fecha_inicio null) flotaría al tope aunque no sea la más
  --    reciente. Solo importa si hubiera >1 etapa abierta (anomalía de datos;
  --    el gate duro de iniciar_nueva_etapa la previene), pero determinístico
  --    de verdad es barato.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
       and et.fecha_finalizacion is null
     order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
     limit 1;
  end if;

  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Actualizar identidad in-place (sin gate de progreso).
  --     Fecha de nacimiento obligatoria (activacionPorTelefono, Epic 2 Task 2.1):
  --     es el segundo factor del canje de OTP; una ficha sin fecha nunca puede
  --     activarse.
  if p_fecha_nacimiento is null then
    raise exception 'fecha_nacimiento_requerida' using errcode = '23502';
  end if;

  --     Email es obligatorio (DEC-E3-2): fallar antes del update.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  -- Teléfono obligatorio (activacionPorTelefono, DEC-05): mismo patrón que
  -- email_requerido; la normalización a la forma canónica la hace el trigger
  -- normalizar_telefono_pacientes (21_pacientes.sql), no acá.
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    raise exception 'telefono_requerido' using errcode = '23502';
  end if;

  -- Email bloqueado una vez activada la cuenta (pulidoBeta, BETA-030): el email
  -- de la ficha llega a auth.users una sola vez, al activar. Cambiarlo acá
  -- después dejaría la ficha con un email y el login con otro, sin avisarle a
  -- nadie, así que con user_id vinculado se rechaza. La comparación sigue la
  -- regla de "Email de la ficha" (CONTEXT.md): mayúsculas y espacios no cuentan,
  -- así que reenviar el mismo email no falla y el resto de los datos se guarda.
  if exists (
    select 1
      from public.pacientes as p
     where p.id = p_paciente_id
       and p.user_id is not null
       and lower(btrim(p.email)) is distinct from lower(btrim(p_email))
  ) then
    raise exception 'email_bloqueado_por_cuenta' using errcode = 'P0001';
  end if;

  -- Con cuenta, el email guardado se conserva tal cual: lo que llega es, a lo
  -- sumo, una variante de mayúsculas/espacios del mismo email, y no debe
  -- pisarlo. El `case` lee user_id de la misma fila que escribe, así que también
  -- cubre una activación que entre justo entre el guard de arriba y este update.
  update public.pacientes as p
     set nombre           = btrim(p_nombre),
         fecha_nacimiento = p_fecha_nacimiento,
         email            = case
                              when p.user_id is not null then p.email
                              else btrim(p_email)
                            end,
         telefono         = nullif(btrim(coalesce(p_telefono, '')), '')
   where p.id = p_paciente_id;

  if not found then
    raise exception 'paciente_inexistente'
      using errcode = 'P0002',
            detail  = 'p_paciente_id no coincide con ningún paciente';
  end if;
end;
$$;

comment on function public.update_paciente_identidad(uuid, text, date, text, text) is
  'Corrige la identidad de un paciente in-place. Acceso: terapeuta de la asignación activa o admin. Siempre editable (sin gate de progreso). Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza email_bloqueado_por_cuenta (P0001) si el paciente ya activó su cuenta (user_id no nulo) y p_email difiere del email de la ficha, sin contar mayúsculas ni espacios (pulidoBeta, BETA-030); con cuenta, el email guardado nunca se reescribe.';

grant execute on function public.update_paciente_identidad(uuid, text, date, text, text) to authenticated;
