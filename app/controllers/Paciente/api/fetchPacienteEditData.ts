'use client'

import { createClient } from '@/lib/supabase/client'
import type { PacienteEditRaw } from '../utils/mapAsignacionToPacienteEditData'
import { mapAsignacionToPacienteEditData } from '../utils/mapAsignacionToPacienteEditData'
import type { PacienteEditData } from '../PacienteTypes'

const fetchPacienteEditData = async (
  pacienteId: string,
): Promise<{ data: PacienteEditData | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('asignaciones_paciente')
    .select(
      `pacientes ( nombre, telefono, email, fecha_nacimiento, user_id, etapas_tratamiento ( id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, created_at, fecha_finalizacion, etapa_bloqueos ( bloqueo_id ), etapa_alfabetos ( alfabeto_id, numero, alfabetos ( orden ) ), niveles ( fecha_seguimiento_real, nivel_evaluacion ( id ) ), entregas_plan ( fecha_entregada ) ) )`,
    )
    .eq('paciente_id', pacienteId)
    .is('fecha_hasta', null)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: mapAsignacionToPacienteEditData(data as unknown as PacienteEditRaw),
    error: null,
  }
}

export { fetchPacienteEditData }
