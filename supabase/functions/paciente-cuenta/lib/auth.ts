import { createClient } from 'jsr:@supabase/supabase-js@2'

type PatientAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401; error: string }

/** Minimal shape this module needs from the caller-scoped Supabase client. */
interface UserClientLike {
  auth: { getUser: () => Promise<{ error: unknown }> }
}

type UserClientFactory = (authHeader: string) => UserClientLike

/**
 * Decodifica el payload de un JWT de forma base64url-safe.
 *
 * Copiado de paciente-invitacion/lib/auth.ts, NO de terapeuta-invitations, que
 * usa `atob` pelado: los payloads vienen en base64url (alfabeto con `-`/`_` y
 * sin padding) y `atob` lanza ante esos caracteres, 401-eando a un llamador
 * legítimo. Ese bug ya se encontró y se arregló una vez en este repo; el test
 * de regresión vive en auth.test.ts.
 */
const decodeJwtPayload = (b64url: string): unknown => {
  const b64 = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(b64url.length / 4) * 4, '=')
  return JSON.parse(atob(b64))
}

const defaultUserClientFactory: UserClientFactory = (authHeader) =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  ) as unknown as UserClientLike

/**
 * Verifica que el request venga de un usuario autenticado y devuelve su `sub`.
 *
 * Este endpoint borra la cuenta del LLAMADOR, así que el único dato de identidad
 * que puede usarse es el que sale del token verificado. El `p_user_id` que va a
 * la RPC sale de acá y NUNCA del body: si se leyera del body, cualquier paciente
 * logueado podría cerrarle la cuenta a otro.
 *
 * Pasos:
 *   1. Sin header Authorization → 401.
 *   2. Decodificar el payload (base64url-safe) y extraer `sub`. Este paso NO
 *      autoriza: la firma no se valida acá, solo se extrae el claim.
 *   3. Verificar el token de verdad: cliente anon con el header del llamador y
 *      getUser(). Si falla → 401. Este es el paso que hace seguro al paso 2.
 *
 * `createUserClient` se inyecta solo para los tests; en producción se usa el
 * default.
 *
 * No hay camino de X-Cron-Secret: esto lo dispara el paciente y nadie más.
 */
const checkPatientAuth = async (
  req: Request,
  createUserClient: UserClientFactory = defaultUserClientFactory,
): Promise<PatientAuthResult> => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { ok: false, status: 401, error: 'no_autorizado' }

  let userId: string
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const [, payloadB64] = token.split('.')
    if (!payloadB64) return { ok: false, status: 401, error: 'no_autorizado' }

    const payload = decodeJwtPayload(payloadB64) as { sub?: unknown }
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return { ok: false, status: 401, error: 'no_autorizado' }
    }
    userId = payload.sub
  } catch {
    return { ok: false, status: 401, error: 'no_autorizado' }
  }

  const { error } = await createUserClient(authHeader).auth.getUser()
  if (error) return { ok: false, status: 401, error: 'no_autorizado' }

  return { ok: true, userId }
}

export { checkPatientAuth }
export type { PatientAuthResult }
