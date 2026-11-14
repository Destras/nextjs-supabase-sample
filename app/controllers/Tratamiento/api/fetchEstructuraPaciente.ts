'use client'

import { createClient } from '@/lib/supabase/client'
import type { EstructuraPaciente } from '../TratamientoTypes'
import type { EstructuraPacienteRaw } from '../utils/mapEstructuraPaciente'
import { mapEstructuraPaciente } from '../utils/mapEstructuraPaciente'

interface FetchEstructuraPacienteResult {
  readonly data: EstructuraPaciente | null
  readonly error: string | null
}

// Read path only — get_estructura_paciente's authz failure (42501, "no
// autorizado") doesn't need the {code, message, details, hint} preservation
// contract that callMedicionRpc exists for; that contract is reserved for the
// three write RPCs, whose errors mapMedicionError must disambiguate by code
// AND message (design §4.3, R2).
const fetchEstructuraPaciente = async (
  pacienteId: string,
): Promise<FetchEstructuraPacienteResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_estructura_paciente', {
    p_paciente_id: pacienteId,
  })

  if (error) return { data: null, error: error.message }

  return {
    data: mapEstructuraPaciente(data as EstructuraPacienteRaw),
    error: null,
  }
}

export { fetchEstructuraPaciente }
export type { FetchEstructuraPacienteResult }
