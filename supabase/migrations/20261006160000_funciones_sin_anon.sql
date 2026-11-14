-- =============================================================================
-- seguridadPanel / SEG-005 — Las funciones de public no se ejecutan sin login
-- =============================================================================
-- Medido en local antes de esta migración: 41 de las 71 funciones de `public`
-- eran ejecutables por `anon` (sin login, por PostgREST), y varias funciones
-- escritas como "privadas" las podía ejecutar cualquier usuario logueado.
--
-- Por qué: Postgres le da EXECUTE a PUBLIC en toda función nueva (y `anon` es
-- miembro de PUBLIC), y el bootstrap de Supabase suma un default que le da
-- EXECUTE a `authenticated` en toda función de public. Un `revoke ... from
-- public` suelto no saca ninguno de los dos caminos a la vez.
--
-- Esta migración:
--   1. Cambia los defaults: una función nueva nace ejecutable solo por su
--      dueño y por service_role. El revoke de PUBLIC va sin `in schema`: es un
--      default global y los defaults por schema solo suman.
--   2. Recrea is_admin(uuid) e is_console_user(uuid): a un usuario final solo
--      le responden sobre sí mismo (dejan de ser un oráculo de roles).
--   3. Recrea list_pacientes_by_terapeuta con el guard NULL-safe: sin usuario,
--      `auth.uid() = p_terapeuta_id` daba NULL y el guard fallaba abierto (una
--      llamada sin login listaba los pacientes de cualquier terapeuta).
--   4. Le saca el EXECUTE de TODAS las funciones de public a PUBLIC, anon y
--      authenticated, y se lo devuelve a `authenticated` solo en la lista
--      permitida: los RPC del panel, los de la app del paciente y los helpers
--      que las policies evalúan con el rol del usuario.
--
-- service_role conserva EXECUTE sobre todas (las Edge Functions llaman con
-- service role a solicitar_otp_activacion, marcar_otp_entregado, validar_otp,
-- validar_otp_para_creacion, vincular_cuenta_paciente,
-- resolver_documentos_legales_vigentes, baja_voluntaria_paciente,
-- deactivate_terapeuta, reactivate_terapeuta e is_admin).
--
-- Ninguna función necesita `anon`: el pedido de OTP y la activación de la
-- cuenta del paciente van por Edge Function con service role.
--
-- Quedan privadas (ni anon ni authenticated): los helpers internos
-- (get_mi_paciente_id, etapa_plan_completo, evaluar_otp, hashear_otp,
-- generar_codigo_otp, semanas_de_etapa, frases_de_etapa, entrega_liberada,
-- derive_alertas_activas, normalizar_telefono_ar, _validar_valores_medicion,
-- _medicion_editable, _insertar_medicion, _generar_cierre_automatico), todo el
-- módulo de OTP, las de service role y las funciones de trigger.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

-- 1. Defaults: las funciones futuras nacen privadas.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;

-- 2. Oráculo de roles.
create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      p_user_id = (select auth.uid())
      or coalesce((select auth.role()), '') not in ('authenticated', 'anon')
    )
    and exists (
      select 1
        from public.profiles p
        join public.roles    r on r.id = p.rol_id
       where p.id      = p_user_id
         and r.codigo  = 'admin'
    ),
    false
  );
$$;

comment on function public.is_admin is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin". Usada como guarda en RPCs admin-only. A un usuario final (JWT authenticated/anon) solo le responde sobre sí mismo: con un p_user_id ajeno devuelve false (seguridadPanel / SEG-005). service_role y las llamadas internas preguntan por cualquiera. Nunca devuelve NULL.';


create or replace function public.is_console_user(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      p_user_id = (select auth.uid())
      or coalesce((select auth.role()), '') not in ('authenticated', 'anon')
    )
    and exists (
      select 1
        from public.profiles p
        join public.roles    r on r.id = p.rol_id
       where p.id      = p_user_id
         and r.codigo  in ('admin', 'terapeuta')
    ),
    false
  );
$$;

comment on function public.is_console_user is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin" o "terapeuta" — es decir, es un usuario de consola, no un paciente. rol_id null (pacientes) falla el join y devuelve false. Usada en las policies de lectura de la biblioteca y del catálogo clínico (seguridadPanel / SEG-001), en la de contenido_imagenes y en el proxy del panel. A un usuario final (JWT authenticated/anon) solo le responde sobre sí mismo: con un p_user_id ajeno devuelve false (seguridadPanel / SEG-005). Nunca devuelve NULL.';

-- 3. list_pacientes_by_terapeuta: guard NULL-safe.
create or replace function public.list_pacientes_by_terapeuta(p_terapeuta_id uuid)
returns table(
  asignacion_id            uuid,
  paciente_nombre          text,
  nivel_actual             int,
  ultima_evaluacion        timestamptz,
  fecha_inicio_tratamiento date
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  -- Comparación NULL-safe (seguridadPanel / SEG-005): sin usuario,
  -- `auth.uid() = p_terapeuta_id` da NULL y el guard fallaba ABIERTO: una
  -- llamada sin login listaba los pacientes de cualquier terapeuta.
  if not (
    public.is_admin()
    or (auth.uid() is not null and auth.uid() = p_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select ap.id                                                                  as asignacion_id,
           coalesce(pa.nombre, '')                                                as paciente_nombre,
           (
             select max(n.numero_nivel)::int
               from public.niveles              n
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id        = pa.id
                and e.fecha_finalizacion is null
           )                                                                      as nivel_actual,
           (
             select max(ne.fecha_respuesta)
               from public.nivel_evaluacion     ne
               join public.niveles              n on n.id = ne.nivel_id
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id = pa.id
           )                                                                      as ultima_evaluacion,
           ap.fecha_desde                                                         as fecha_inicio_tratamiento
      from public.asignaciones_paciente ap
      join public.pacientes             pa on pa.id = ap.paciente_id
     where ap.terapeuta_id = p_terapeuta_id
       and ap.fecha_hasta  is null
     order by pa.nombre;
end;
$$;

-- 4. Nadie ejecuta nada salvo la lista permitida.
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers que las policies evalúan con el rol del usuario.
grant execute on function public.has_active_assignment(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_console_user(uuid) to authenticated;
grant execute on function public.paciente_puede_ver_objeto(text, text) to authenticated;
grant execute on function public.hoy() to authenticated;

-- App del paciente.
grant execute on function public.get_mi_estructura_actual() to authenticated;
grant execute on function public.get_mi_evaluacion_vigente() to authenticated;
grant execute on function public.get_mi_perfil() to authenticated;
grant execute on function public.get_mi_plan_semanal() to authenticated;
grant execute on function public.get_mi_tratamiento_activo() to authenticated;
grant execute on function public.submit_mi_evaluacion(uuid, integer, integer) to authenticated;

-- Panel.
grant execute on function public.cerrar_etapa(uuid, text, text) to authenticated;
grant execute on function public.cerrar_etapa_con_medicion(uuid, text, jsonb, uuid) to authenticated;
grant execute on function public.count_alertas_terapeuta() to authenticated;
grant execute on function public.count_contenido_usage(uuid) to authenticated;
grant execute on function public.create_contenido(text, text, text, text, integer) to authenticated;
grant execute on function public.create_contenido_galeria(text, text, text, text[]) to authenticated;
grant execute on function public.delete_contenido(uuid) to authenticated;
grant execute on function public.desmarcar_alerta_atendida(text, text, uuid) to authenticated;
grant execute on function public.editar_medicion(uuid, jsonb) to authenticated;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
grant execute on function public.get_estructura_paciente(uuid) to authenticated;
grant execute on function public.get_frases_del_tratamiento_activo(uuid) to authenticated;
grant execute on function public.get_terapeuta(uuid) to authenticated;
grant execute on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;
grant execute on function public.list_alertas_admin(uuid) to authenticated;
grant execute on function public.list_alertas_terapeuta() to authenticated;
grant execute on function public.list_pacientes_by_terapeuta(uuid) to authenticated;
grant execute on function public.list_terapeutas() to authenticated;
grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;
grant execute on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) to authenticated;
grant execute on function public.registrar_medicion(uuid, jsonb, uuid) to authenticated;
grant execute on function public.replace_and_delete_contenido(uuid, uuid) to authenticated;
grant execute on function public.set_contenido_imagenes(uuid, text[]) to authenticated;
grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
grant execute on function public.telefono_en_otra_ficha(text, uuid) to authenticated;
grant execute on function public.update_contenido(uuid, text, text) to authenticated;
grant execute on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;
grant execute on function public.update_paciente_identidad(uuid, text, date, text, text) to authenticated;
grant execute on function public.update_terapeuta(uuid, text, text) to authenticated;
