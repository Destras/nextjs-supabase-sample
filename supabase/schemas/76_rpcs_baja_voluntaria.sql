-- ---------------------------------------------------------------------------
-- baja_voluntaria_paciente
-- ---------------------------------------------------------------------------
-- Baja voluntaria de la cuenta de un paciente, iniciada por el propio paciente
-- desde la app (Edge Function paciente-cuenta, acción delete-account).
--
-- Hace el lado de negocio del borrado en UNA sola transacción: desvincula la
-- ficha clínica de la cuenta de auth, la marca como baja_voluntaria, cierra la
-- asignación y la etapa activas, supersede el OTP vigente y deja rastro en
-- audit_log. NO borra la fila de auth.users: eso lo hace la Edge Function con
-- la Admin API inmediatamente DESPUÉS de que esta función commitea.
--
-- ORDEN NO NEGOCIABLE (el motivo de que esta función exista):
--   pacientes.user_id references auth.users (id) SIN "on delete", o sea NO ACTION.
--   Borrar la cuenta de auth antes de nulear user_id levanta un 23503. Primero
--   esta RPC, después auth.admin.deleteUser(). Invertir el orden rompe.
--
-- Contrato de retorno: jsonb { status, pacienteId }
--   'ok'              → primera corrida; pacienteId = uuid del paciente desvinculado
--   'ya_dado_de_baja' → reentrada idempotente; pacienteId = null
--
-- La rama idempotente devuelve en vez de levantar excepción a propósito: es el
-- camino de recuperación cuando la RPC commitea pero deleteUser falla. Si acá
-- levantáramos 'no_vinculado' (la forma de get_mi_paciente_id), el reintento del
-- paciente sería imposible y quedaría un auth.users huérfano para siempre.
--
-- Errores:
--   42501 no_autorizado  → p_user_id null, o pertenece a un terapeuta/admin
--   P0002 estado_*_no_encontrado → falta una fila de catálogo (aborta sin mutar)
--
-- Acceso: solo service_role (la Edge Function). SIN grant a authenticated: ese
-- es el control anti-IDOR — un paciente logueado no puede llamar esta función
-- con el p_user_id de otro. Los grants y el search_path los fija una migración
-- hand-authored aparte, porque db diff (migra) no detecta ni EXECUTE grants ni
-- proconfig.
-- ---------------------------------------------------------------------------

create or replace function public.baja_voluntaria_paciente(p_user_id uuid)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_estado_baja        uuid;
  v_estado_abandonada  uuid;
  v_paciente_id        uuid;
  v_etapa_id           uuid;
begin
  -- 0. Fail closed. Sin esto un p_user_id null atraviesa todos los lookups
  --    (user_id = null nunca matchea) y cae en la rama idempotente, devolviendo
  --    'ya_dado_de_baja' a un llamador sin identidad.
  if p_user_id is null then
    raise exception 'no_autorizado'
      using errcode = '42501',
            detail  = 'p_user_id es obligatorio';
  end if;

  -- 1. Resolver el catálogo ANTES de mutar nada (mismo patrón que
  --    register_paciente): si falta una fila de catálogo, abortamos limpio en
  --    vez de dejar la baja a mitad de camino.
  select id into v_estado_baja
    from public.estados_paciente
   where codigo = 'baja_voluntaria';

  if v_estado_baja is null then
    raise exception 'estado_baja_voluntaria_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila baja_voluntaria en estados_paciente';
  end if;

  select id into v_estado_abandonada
    from public.estados_etapa
   where codigo = 'abandonada';

  if v_estado_abandonada is null then
    raise exception 'estado_etapa_abandonada_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila abandonada en estados_etapa';
  end if;

  -- 2. Resolver el paciente DENTRO de la transacción, a partir del user_id
  --    verificado. Resolverlo acá (y no recibir un p_paciente_id del llamador)
  --    es lo que cierra la ventana TOCTOU y la superficie de IDOR.
  --    for update serializa un doble tap concurrente: el segundo llamador
  --    bloquea, y cuando entra ya ve user_id null y toma la rama idempotente.
  select id into v_paciente_id
    from public.pacientes
   where user_id = p_user_id
     for update;

  -- 3. Sin paciente vinculado. Antes de asumir "ya dado de baja", descartar que
  --    el llamador sea un terapeuta o un admin: borrarles la cuenta de auth
  --    cascadearía profiles -> terapeutas y destruiría historial de asignaciones.
  --    La baja de terapeutas está explícitamente fuera de alcance. Esto es una
  --    guarda de autorización, no una comodidad: no dejamos que falle sola la FK
  --    de asignaciones_paciente.terapeuta_id, porque apoyarse en un constraint
  --    no es un control de acceso.
  if v_paciente_id is null then
    if public.is_admin(p_user_id)
       or exists (select 1 from public.terapeutas where id = p_user_id) then
      raise exception 'no_autorizado'
        using errcode = '42501',
              detail  = 'La baja voluntaria es solo para cuentas de paciente';
    end if;

    -- Paciente ya desvinculado (reentrada tras un deleteUser fallido), o una
    -- cuenta de auth que no es ni paciente ni terapeuta ni admin. En ambos casos
    -- la Edge Function sigue adelante y borra la cuenta del propio llamador.
    return jsonb_build_object('status', 'ya_dado_de_baja', 'pacienteId', null);
  end if;

  -- 4. Marcar la ficha como baja voluntaria y soltar el vínculo con auth.users.
  --    Nulear user_id es lo que habilita el delete de la cuenta (paso 0 del
  --    contrato) y, de yapa, cierra las cinco RPCs de paciente: todas resuelven
  --    identidad por get_mi_paciente_id(), que ahora levanta no_vinculado.
  update public.pacientes
     set estado_id            = v_estado_baja,
         activo               = false,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = 'Baja voluntaria solicitada por el paciente desde la app',
         user_id              = null
   where id = v_paciente_id;

  -- 5. Cerrar la asignación activa. Esto es lo que saca al paciente de las
  --    listas, dashboards y alertas del terapeuta: todos los consumidores
  --    filtran por fecha_hasta is null, ninguno deriva "activo" del catálogo
  --    de estados. Sin este paso el paciente queda de fantasma en la consola.
  update public.asignaciones_paciente
     set fecha_hasta = public.hoy(),
         motivo      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_hasta is null;

  -- 5.5. Cierre automático de la lectura de estructura (medir-chakras design
  --      §3.2), ANTES de cerrar la(s) etapa(s) en el paso 6. El update de
  --      abajo NO tiene limit 1 y puede tocar más de una etapa abierta si hay
  --      una anomalía de datos; este for recorre exactamente el mismo
  --      conjunto para que ninguna quede cerrada sin su copia. Trap B: la
  --      asignación YA se cerró en el paso 5, y esta función corre bajo
  --      service_role (auth.uid() es null) — por eso _generar_cierre_automatico
  --      no toma NINGUNA decisión de autorización, no podría. La función
  --      devuelve null (no-op) para etapas sin mediciones o sin arrancar.
  for v_etapa_id in
    select et.id
      from public.etapas_tratamiento et
     where et.paciente_id = v_paciente_id
       and et.fecha_finalizacion is null
  loop
    perform public._generar_cierre_automatico(v_etapa_id);
  end loop;

  -- 6. Cerrar la etapa de tratamiento activa, si la hay. Un paciente sin etapa
  --    activa es un caso válido (no-op), no un error.
  update public.etapas_tratamiento
     set estado_id          = v_estado_abandonada,
         fecha_finalizacion = public.hoy(),
         motivo_cierre      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_finalizacion is null;

  -- 7. Supersede el OTP de activación vigente. Con user_id ya en null,
  --    validar_otp_para_creacion devolvería 'ok' para un OTP active y dejaría
  --    crear una cuenta nueva sobre la ficha conservada. Este es el primer
  --    anillo de defensa; el segundo son las guardas de emisión en
  --    generar_otp_activacion / regenerar_otp_activacion.
  update public.otps_activacion
     set estado = 'superseded'
   where paciente_id = v_paciente_id
     and estado      = 'active';

  -- 8. Rastro de auditoría. usuario_id tiene que ser null: audit_log.usuario_id
  --    referencia profiles(id) con NO ACTION, y esa fila está por desaparecer
  --    en el cascade de auth.users. Guardamos el user_id previo en
  --    datos_anteriores para no perder quién pidió la baja — sin eso la fila de
  --    auditoría registra que "algo pasó" pero no quién, y no cumple su función.
  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores)
  values (
    'pacientes',
    v_paciente_id::text,
    'baja_voluntaria',
    null,
    jsonb_build_object('user_id', p_user_id)
  );

  return jsonb_build_object('status', 'ok', 'pacienteId', v_paciente_id);
end;
$$;

comment on function public.baja_voluntaria_paciente(uuid) is
  'Baja voluntaria de la cuenta de un paciente: desvincula user_id, marca la ficha como baja_voluntaria, genera cierre_automatico de estructura (medir-chakras) para cada etapa abierta con mediciones previas, cierra asignación y etapa(s) activas, supersede el OTP vigente y audita. Devuelve jsonb {status: ok|ya_dado_de_baja, pacienteId}. Idempotente a propósito: la reentrada es el camino de recuperación si auth.admin.deleteUser falla. NO borra auth.users — eso lo hace la Edge Function paciente-cuenta inmediatamente después. Levanta no_autorizado (42501) si p_user_id es null o pertenece a un terapeuta/admin. Acceso: service_role.';

-- Sin grant a authenticated: ese es el control anti-IDOR. Un paciente logueado
-- no puede llamar esta función con el p_user_id de otro; solo la Edge Function,
-- que corre con service_role y ya verificó que p_user_id es el sub de su JWT.
--
-- OJO: `revoke ... from public` NO alcanza. Supabase corre
--   alter default privileges for role postgres in schema public grant execute
--     on functions to authenticated, service_role;
-- así que toda función nueva en public nace con un grant DIRECTO a
-- authenticated, que un revoke a PUBLIC no toca. Hay que revocarle
-- explícitamente. Verificado: sin este revoke, has_function_privilege(
-- 'authenticated', ...) devuelve true (assert A11 en supabase/tests/baja_voluntaria.sql).
revoke execute on function public.baja_voluntaria_paciente(uuid) from public;
revoke execute on function public.baja_voluntaria_paciente(uuid) from anon;
revoke execute on function public.baja_voluntaria_paciente(uuid) from authenticated;

grant execute on function public.baja_voluntaria_paciente(uuid) to service_role;
