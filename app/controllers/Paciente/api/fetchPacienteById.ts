'use client'

import { createClient } from '@/lib/supabase/client'
import type { AsignacionRaw } from '../utils/mapAsignacionToPaciente'
import { mapAsignacionToPaciente } from '../utils/mapAsignacionToPaciente'
import type { Paciente } from '../PacienteTypes'

const fetchPacienteById = async (
  pacienteId: string,
): Promise<{ data: Paciente | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('asignaciones_paciente')
    .select(
      `id, pacientes ( id, nombre, telefono, email, fecha_nacimiento, fecha_alta, user_id, bienvenida_entregada_at, estados_paciente ( codigo ), etapas_tratamiento ( id, fecha_inicio, created_at, fecha_finalizacion, causas ( nombre, definicion, emociones_esperadas ), modalidades ( cantidad_niveles, cantidad_sesiones, tipos_disco ( nombre ) ), algoritmos ( nombre, definicion ), etapa_alfabetos ( numero, alfabetos ( id, nombre, orden ) ), etapa_bloqueos ( bloqueos ( id, nombre ) ), niveles ( id, numero_nivel, fecha_seguimiento_esperada, fecha_seguimiento_real, nivel_evaluacion ( id, score, fecha_respuesta ) ) ) )`,
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
    data: mapAsignacionToPaciente(data as unknown as AsignacionRaw),
    error: null,
  }
}

export { fetchPacienteById }
