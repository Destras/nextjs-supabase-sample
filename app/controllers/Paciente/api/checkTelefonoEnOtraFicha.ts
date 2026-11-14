'use client'

import { createClient } from '@/lib/supabase/client'
import type { TelefonoEnOtraFichaResult } from '../PacienteTypes'

// Calls the telefono_en_otra_ficha RPC (activacionPorTelefono Task 2.2): normalizes
// server-side and returns true when another ficha (≠ excluirPacienteId) already has
// that phone. Non-blocking check — an RPC error collapses to `enOtraFicha: false` so a
// failed check never fabricates a false-positive warning.
const checkTelefonoEnOtraFicha = async (
  telefono: string,
  excluirPacienteId: string | null,
): Promise<TelefonoEnOtraFichaResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('telefono_en_otra_ficha', {
    p_telefono: telefono,
    p_excluir_paciente_id: excluirPacienteId,
  })

  if (error) return { enOtraFicha: false, error: error.message }
  return { enOtraFicha: data === true, error: null }
}

export { checkTelefonoEnOtraFicha }
