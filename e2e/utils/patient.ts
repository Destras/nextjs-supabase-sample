import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Signs in as the patient via `signInWithPassword` on an anon client — the
 * same auth path the mobile app uses, not a backdoor. The returned client
 * is scoped to that session and is the one to use for `submitEvaluacion`.
 */
const signInAsPatient = async (
  email: string,
  password: string,
): Promise<SupabaseClient> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      'signInAsPatient: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.',
    )
  }

  const client = createClient(supabaseUrl, anonKey)

  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(
      `signInAsPatient: signInWithPassword failed: ${error.message}`,
    )
  }

  return client
}

/**
 * Submits the patient's self-evaluation for a given `nivel` via the real
 * `submit_mi_evaluacion` RPC, using a client authenticated as that patient
 * (from `signInAsPatient`).
 */
const submitEvaluacion = async (
  patientClient: SupabaseClient,
  nivelId: string,
  scoreCausa: number,
  scoreAlgoritmo: number,
): Promise<void> => {
  const { data, error } = await patientClient.rpc('submit_mi_evaluacion', {
    p_nivel_id: nivelId,
    p_score_causa: scoreCausa,
    p_score_algoritmo: scoreAlgoritmo,
  })

  if (error) {
    throw new Error(
      `submitEvaluacion: submit_mi_evaluacion failed: ${error.message}`,
    )
  }
  if (!data || (data as { ok?: boolean }).ok !== true) {
    throw new Error(
      `submitEvaluacion: submit_mi_evaluacion did not return { ok: true } for nivel ${nivelId}.`,
    )
  }
}

export { signInAsPatient, submitEvaluacion }
