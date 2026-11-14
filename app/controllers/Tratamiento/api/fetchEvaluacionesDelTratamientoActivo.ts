'use client'

import { createClient } from '@/lib/supabase/client'
import type { EtapaConNivelesRow } from '../utils/mapEtapaToTratamientoConNiveles'
import { mapEtapaToTratamientoConNiveles } from '../utils/mapEtapaToTratamientoConNiveles'
import type { Tratamiento } from '../TratamientoTypes'

interface FetchEvaluacionesResult {
  readonly tratamiento: Tratamiento | null
  readonly error: string | null
}

const fetchEvaluacionesDelTratamientoActivo = async (
  pacienteId: string,
): Promise<FetchEvaluacionesResult> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('etapas_tratamiento')
    .select(
      `
      id, fecha_inicio, fecha_finalizacion, motivo_cierre, notas_diagnostico,
      estados_etapa!inner(codigo),
      causas!inner(id, codigo, nombre, definicion, emociones_esperadas, activo),
      algoritmos!inner(id, codigo, nombre, definicion, comportamiento, activo),
      etapa_bloqueos(bloqueos(id, codigo, nombre, descripcion, activo)),
      niveles(
        id, numero_nivel, fecha_seguimiento_esperada, fecha_seguimiento_real, observaciones,
        nivel_evaluacion(id, score, fecha_respuesta)
      )
    `,
    )
    .eq('paciente_id', pacienteId)
    .is('fecha_finalizacion', null)
    .maybeSingle()

  if (error !== null) return { tratamiento: null, error: error.message }
  if (data === null) return { tratamiento: null, error: null }
  return {
    tratamiento: mapEtapaToTratamientoConNiveles(
      data as unknown as EtapaConNivelesRow,
    ),
    error: null,
  }
}

export { fetchEvaluacionesDelTratamientoActivo }
export type { FetchEvaluacionesResult }
