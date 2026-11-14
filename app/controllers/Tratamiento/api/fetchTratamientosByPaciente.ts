'use client'

import { createClient } from '@/lib/supabase/client'
import type { EtapaTratamientoRaw } from '../utils/mapEtapaToTratamiento'
import { mapEtapaToTratamiento } from '../utils/mapEtapaToTratamiento'
import type { Tratamiento } from '../TratamientoTypes'

const fetchTratamientosByPaciente = async (
  pacienteId: string,
): Promise<{ data: Tratamiento[] | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('etapas_tratamiento')
    .select(
      `id,
       fecha_inicio,
       fecha_finalizacion,
       estados_etapa ( codigo ),
       causas ( id, codigo, nombre, definicion, emociones_esperadas, activo ),
       algoritmos ( id, codigo, nombre, definicion, comportamiento, activo ),
       etapa_bloqueos ( bloqueos ( id, codigo, nombre, descripcion, activo ) )`,
    )
    .eq('paciente_id', pacienteId)

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  const mapped = (data as unknown as EtapaTratamientoRaw[])
    .map(mapEtapaToTratamiento)
    .filter((t): t is Tratamiento => t !== null)

  return { data: mapped, error: null }
}

export { fetchTratamientosByPaciente }
