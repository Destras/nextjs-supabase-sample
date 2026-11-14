'use client'

import { createClient } from '@/lib/supabase/client'
import type { BuscarFichaPorEmailResult } from '../PacienteTypes'
import type { FichaPorEmailRowRaw } from '../utils/mapFichaPorEmailRow'
import { mapFichaPorEmailRow } from '../utils/mapFichaPorEmailRow'

// Busca la ficha que ya tiene ese email, con la sesión del terapeuta (ADR 0010). No
// hay regla de privacidad acá: la ponen las RLS de `pacientes`. Si la fila vuelve, la
// ficha es o FUE del terapeuta (o el caller es admin): las RLS no miran `fecha_hasta`,
// así que `accesible` dice si todavía tiene una asignación abierta (BETA-034). Si no
// vuelve, es de otro terapeuta o no existe, y el caller no puede distinguir los dos
// casos — a propósito.
// El email se compara EXACTO, igual que el índice único: normalizar mayúsculas acá
// encontraría fichas con las que el alta en los hechos no chocó.
const buscarFichaPorEmail = async (
  email: string,
  excluirPacienteId: string | null,
): Promise<BuscarFichaPorEmailResult> => {
  const supabase = createClient()
  const porEmail = supabase
    .from('pacientes')
    .select(
      'id, nombre, estados_paciente ( codigo ), asignaciones_paciente ( fecha_hasta )',
    )
    .eq('email', email)
  const query =
    excluirPacienteId === null
      ? porEmail
      : porEmail.neq('id', excluirPacienteId)

  const { data, error } = await query.maybeSingle()

  if (error) return { ficha: null, error: error.message }
  if (data === null) return { ficha: null, error: null }
  return {
    ficha: mapFichaPorEmailRow(data as unknown as FichaPorEmailRowRaw),
    error: null,
  }
}

export { buscarFichaPorEmail }
