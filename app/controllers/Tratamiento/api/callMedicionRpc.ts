'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  MedicionMutationResult,
  MedicionRpcError,
} from '../TratamientoTypes'

// Dedicated RPC tail for the medicion-estructura write/read paths. Unlike
// `Paciente/api/callUpdateRpc.ts:15` (collapses the response to
// `{ error: error.message }`, destroying `error.code`), this tail preserves
// the full { code, message, details, hint } envelope — required so
// mapMedicionError can distinguish PT409 from 22023 and switch on `message`
// before `code` for the overloaded 42501 (design §4.3, R2).
const callMedicionRpc = async <T>(
  fn: string,
  params: Record<string, unknown>,
): Promise<MedicionMutationResult<T>> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc(fn, params)

  if (error) {
    const mapped: MedicionRpcError = {
      code: error.code,
      message: error.message,
      details: error.details || null,
      hint: error.hint || null,
    }
    return { data: null, error: mapped }
  }

  return { data: data as T, error: null }
}

export { callMedicionRpc }
