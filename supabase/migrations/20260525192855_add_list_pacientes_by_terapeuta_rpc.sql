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
  if not (public.is_admin() or auth.uid() = p_terapeuta_id) then
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

comment on function public.list_pacientes_by_terapeuta(uuid) is
  'Lista los pacientes activos asignados a un terapeuta, con nivel actual (max de niveles en etapas no finalizadas) y última evaluación (max fecha_respuesta cross-etapa). Acceso: el propio terapeuta o un admin.';

grant execute on function public.list_pacientes_by_terapeuta(uuid) to authenticated;
