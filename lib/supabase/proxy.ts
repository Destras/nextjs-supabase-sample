import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasEnvVars } from '../utils'
import {
  ACCESO,
  cookiesDeSesion,
  decidirAccesoAlPanel,
  requiereSerConsola,
} from './accesoAlPanel'
import { crearCacheDeConsola } from './cacheDeConsola'

const RUTA_LOGIN = '/auth/login'
// Código que lee el login para mostrar "Esta cuenta no tiene acceso al panel".
const ERROR_SIN_ACCESO = 'sin_acceso'

type ClienteDelRequest = ReturnType<typeof createServerClient>

// Una sesión de consola ya verificada no se vuelve a consultar por 60 s. Solo
// se recuerdan los `true`; ver ./cacheDeConsola.ts para qué cuesta y qué no.
const cacheDeConsola = crearCacheDeConsola({
  ttlMs: 60_000,
  max: 1_000,
  ahora: Date.now,
})

// true / false: lo que respondió la base. null: no se pudo saber.
//
// FAIL-OPEN SOLO ANTE ERROR: si la consulta falla (red, 500, timeout) NO se
// expulsa a nadie; se deja pasar y RLS decide qué datos ve. Un `false` de la
// base nunca se trata como error: ese sí expulsa.
const consultarSiEsConsola = async (
  supabase: ClienteDelRequest,
  sesion: string | null,
): Promise<boolean | null> => {
  if (sesion !== null && cacheDeConsola.esConsolaVigente(sesion)) return true
  try {
    const { data, error } = await supabase.rpc('is_console_user')
    if (error) return null
    const esConsola = data === true
    if (esConsola && sesion !== null) cacheDeConsola.recordar(sesion)
    return esConsola
  } catch {
    return null
  }
}

// La sesión del JWT (`session_id`); si el token no la trae, el usuario (`sub`).
const claveDeSesion = (
  claims: Record<string, unknown> | undefined,
): string | null => {
  const sesion = claims?.session_id ?? claims?.sub
  return typeof sesion === 'string' && sesion !== '' ? sesion : null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const pathname = request.nextUrl.pathname
  const haySesion = Boolean(user)

  // ¿Quién entra? (seguridadPanel / SEG-003). Tener sesión no alcanza: los
  // pacientes tienen cuenta en el mismo Supabase Auth. El JWT no lleva el rol,
  // así que se consulta `is_console_user` (terapeuta o admin) con el cliente de
  // este request. Costo: una consulta por request de página, salvo que la
  // sesión ya se haya verificado en el último minuto (cacheDeConsola).
  //
  // Terapeuta desactivado (seguridadPanel / SEG-007): `getClaims()` verifica el
  // JWT localmente y no ve el ban de Auth, así que el access token que ya
  // tenía sigue valiendo hasta que vence. Lo que lo saca es este mismo chequeo:
  // `is_console_user` devuelve false para un terapeuta en estado `inactivo`.
  // Lo expulsa en su próximo request, o a lo sumo 60 s después si su sesión
  // estaba en la memoria (cacheDeConsola); los datos los corta RLS en el acto.
  const esConsola =
    haySesion && requiereSerConsola(pathname)
      ? await consultarSiEsConsola(supabase, claveDeSesion(user))
      : null

  const acceso = decidirAccesoAlPanel({ pathname, haySesion, esConsola })

  if (acceso === ACCESO.IR_A_LOGIN) {
    const url = request.nextUrl.clone()
    url.pathname = RUTA_LOGIN
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (acceso === ACCESO.EXPULSAR) {
    // `scope: 'local'` cierra SOLO esta sesión. El default ('global') revoca
    // todas las del usuario: a un paciente que probó entrar al panel le
    // cerraría también la app.
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Si el signOut falla, las cookies se borran igual acá abajo.
    }

    const url = request.nextUrl.clone()
    url.pathname = RUTA_LOGIN
    url.search = `?error=${ERROR_SIN_ACCESO}`
    const respuesta = NextResponse.redirect(url)

    // Las cookies que el signOut dejó en supabaseResponse viajan en el
    // redirect, y además se vencen a mano las de sesión que trajo el request:
    // la respuesta nunca deja una sesión viva en el navegador.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => respuesta.cookies.set(cookie))
    cookiesDeSesion(request.cookies.getAll().map(({ name }) => name)).forEach(
      (name) => respuesta.cookies.set(name, '', { maxAge: 0, path: '/' }),
    )
    return respuesta
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
