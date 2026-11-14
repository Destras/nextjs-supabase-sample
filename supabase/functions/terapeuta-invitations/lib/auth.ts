import { createClient } from 'jsr:@supabase/supabase-js@2'

const checkAdmin = async (
  req: Request,
): Promise<
  | { ok: true; callerId: string }
  | { ok: false; status: 401 | 403; error: string }
> => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { ok: false, status: 401, error: 'no_autorizado' }

  // Extract sub (user id) from the JWT payload — we need it before the RPC
  // to pass as p_caller_id to RPCs that run under service-role (auth.uid()
  // returns null in that context).
  let callerId: string
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(atob(payloadB64))
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return { ok: false, status: 401, error: 'no_autorizado' }
    }
    callerId = payload.sub
  } catch {
    return { ok: false, status: 401, error: 'no_autorizado' }
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data, error } = await supabaseUser.rpc('is_admin')
  if (error || !data) return { ok: false, status: 403, error: 'no_autorizado' }
  return { ok: true, callerId }
}

export { checkAdmin }
