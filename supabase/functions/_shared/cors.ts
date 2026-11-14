/**
 * CORS para las Edge Functions que llama el **navegador**.
 *
 * POR QUÉ EXISTE
 * --------------
 * `supabase.functions.invoke()` desde el panel manda `Authorization` y
 * `Content-Type: application/json`. Eso convierte al pedido en "no simple", así
 * que el navegador manda antes un preflight `OPTIONS`. Si la función responde
 * 405 —que es lo que hace un handler que solo acepta POST—, el POST real nunca
 * se envía y el panel ve un error de red sin más información.
 *
 * ⚠️ EN LOCAL ESTO NO SE NOTA. El stack local rutea por Kong, que contesta el
 * preflight por su cuenta con `Access-Control-Allow-Origin: *`. En producción no
 * hay Kong: Supabase rutea directo a la función. De ahí que un flujo pueda andar
 * perfecto en dev y estar roto en prod sin que ningún test lo agarre — los tests
 * usan `curl` o mocks, que no hacen preflight.
 *
 * Detectado el 2026-09-28 en producción: el panel no podía disparar la
 * bienvenida (`paciente-invitacion`), ni invitar/revocar/desactivar terapeutas
 * (`terapeuta-invitations`).
 *
 * `Access-Control-Allow-Origin: *` es seguro acá: la autorización viaja en el
 * header `Authorization` (o `X-Cron-Secret`), no en cookies, así que no hay
 * credenciales que un origen ajeno pueda reusar sin tener el token.
 *
 * NO hace falta en `patient-activation`: la llama la app móvil por HTTP nativo,
 * que no aplica la política de mismo origen.
 */
const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  // `apikey` y `x-client-info` los agrega supabase-js solo; `x-cron-secret` es
  // el camino del cron de paciente-invitacion.
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Devuelve la respuesta al preflight cuando el método es `OPTIONS`, o `null`
 * cuando no lo es — para que el handler siga su curso normal.
 *
 * 204 y no 200: no hay cuerpo que devolver.
 */
const preflightResponse = (req: Request): Response | null =>
  req.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: CORS_HEADERS })
    : null

/**
 * withCors — envuelve el handler de `Deno.serve` y resuelve de una vez las dos
 * mitades del mismo problema: que el navegador pueda hablar con la función, y
 * que pueda VER lo que la función responde cuando algo sale mal.
 *
 *   1. Contesta el preflight `OPTIONS` sin invocar al handler.
 *   2. Atrapa cualquier excepción y devuelve un 500 **con** las cabeceras CORS.
 *
 * El punto 2 importa más de lo que parece. Sin él, una excepción no capturada
 * la contesta Deno con un 500 pelado, sin CORS — y el navegador entonces NO
 * muestra el 500: muestra un error de CORS. O sea que cualquier bug futuro se
 * presenta con el síntoma equivocado y manda a quien lo diagnostique a mirar
 * la configuración de CORS en vez del error real. Ya nos pasó una vez (2026-09-28).
 *
 * El cuerpo del 500 es genérico a propósito: el detalle va al log del servidor,
 * no al cliente.
 */
const withCors =
  (handler: (req: Request) => Response | Promise<Response>) =>
  async (req: Request): Promise<Response> => {
    const preflight = preflightResponse(req)
    if (preflight !== null) return preflight

    try {
      return await handler(req)
    } catch (err) {
      console.error(
        JSON.stringify({
          error: 'excepcion_no_capturada',
          message: err instanceof Error ? err.message : String(err),
        }),
      )
      return new Response(JSON.stringify({ error: 'error_inesperado' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  }

export { CORS_HEADERS, preflightResponse, withCors }
