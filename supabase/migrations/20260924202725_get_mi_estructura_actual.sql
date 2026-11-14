set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_mi_estructura_actual()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_result      jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id
    into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Proyectar las mediciones de la etapa, orden cronológico, excluyendo
  --    cierre_automatico (DEC-M06). fecha resuelta en
  --    America/Argentina/Buenos_Aires server-side (la clínica es Argentina-only).
  select jsonb_build_object('mediciones', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', me.id,
      -- La clínica es Argentina-only; no existe timezone de clínica en SQL.
      -- Resuelto server-side para que el timezone del dispositivo nunca corra el día.
      'fecha', (me.registrada_en at time zone 'America/Argentina/Buenos_Aires')::date,
      'momento', me.momento,
      'estructuraGeneral', me.estructura_general,
      'valores', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'codigo', ce.codigo, 'etiquetaPaciente', ce.etiqueta_paciente,
                 'orden', ce.orden, 'valor', mv.valor) order by ce.orden)
          from public.medicion_valores as mv
          join public.centros_energeticos as ce on ce.id = mv.centro_id
         where mv.medicion_id = me.id), '[]'::jsonb))
    order by me.registrada_en asc, me.id asc), '[]'::jsonb))
    into v_result
    from public.mediciones_estructura as me
   where me.etapa_id = v_etapa_id
     and me.momento <> 'cierre_automatico';   -- DEC-M06

  return v_result;
end;
$function$
;

-- Manual append: function EXECUTE grants are a known migra limitation (not
-- captured by `supabase db diff`) — see .claude/supabase-migration/SKILL.md.
grant execute on function public.get_mi_estructura_actual() to authenticated;

-- Manual append: `comment on function ...` is a known migra limitation (not
-- captured by `supabase db diff`) — see .claude/supabase-migration/SKILL.md.
comment on function public.get_mi_estructura_actual() is
  'Devuelve las mediciones de estructura bioenergética de la etapa activa del paciente caller (medicionEvolutiva): { mediciones: [{ id, fecha, momento, estructuraGeneral, valores: [{codigo, etiquetaPaciente, orden, valor}] }] }, orden cronológico, excluyendo cierre_automatico (DEC-M06). fecha = registrada_en convertida a America/Argentina/Buenos_Aires, resuelta server-side. valores denormaliza codigo/etiquetaPaciente/orden desde el catálogo vigente. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó (fecha_inicio null); no_vinculado (P0001) si no hay vínculo.';
