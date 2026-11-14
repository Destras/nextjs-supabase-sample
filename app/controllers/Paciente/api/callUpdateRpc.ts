'use client'

import { createClient } from '@/lib/supabase/client'
import type { UpdatePacienteResult } from '../PacienteTypes'
import { toRpcErrorCode } from '../utils/toRpcErrorCode'

// Shared tail for the void-returning update RPCs (update_paciente_identidad /
// update_etapa_diagnostico): calls the RPC and collapses the Supabase response
// into the `{ error }` envelope the mutation hooks consume.
const callUpdateRpc = async (
  fn: string,
  params: Record<string, unknown>,
): Promise<UpdatePacienteResult> => {
  const supabase = createClient()
  const { error } = await supabase.rpc(fn, params)
  if (error) return { error: toRpcErrorCode(error) }
  return { error: null }
}

export { callUpdateRpc }
