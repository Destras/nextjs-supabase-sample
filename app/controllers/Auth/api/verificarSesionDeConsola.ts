'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

// ¿Hay que sacar a este navegador del panel? (pulidoBeta / BETA-045)
//
// El proxy ya expulsa a quien no es de consola, pero recuerda 60 s los `true`
// y valida el JWT sin ir a Auth: un terapeuta recién desactivado (sus sesiones
// se borran en `deactivate_terapeuta`) sigue pasando ese minuto y ve un panel
// vacío. Esta consulta es la del lado cliente: le pregunta a Auth si la sesión
// sigue viva y a la base si el usuario sigue siendo de consola.
//
// Devuelve el código que el login traduce (`mapLoginUrlError`), o `null` si no
// hay que expulsar. SOLO expulsa ante una respuesta explícita: un error de red,
// un 5xx o cualquier cosa que no se entienda devuelve `null` (igual criterio
// que el proxy: fail-open, los datos los protege RLS).

const MOTIVO_DE_EXPULSION = {
  SESION_TERMINADA: 'sesion_terminada',
  CUENTA_DESACTIVADA: 'cuenta_desactivada',
  SIN_ACCESO: 'sin_acceso',
} as const

type MotivoDeExpulsion =
  (typeof MOTIVO_DE_EXPULSION)[keyof typeof MOTIVO_DE_EXPULSION]

// Auth respondió, y respondió que este token no vale (sesión borrada o
// vencida, token rechazado, usuario inexistente).
const STATUS_DE_RECHAZO: ReadonlySet<number> = new Set([401, 403, 404])

const leer = (err: unknown, clave: 'code' | 'name' | 'status'): unknown =>
  typeof err === 'object' && err !== null && clave in err
    ? Reflect.get(err, clave)
    : undefined

const motivoPorErrorDeAuth = (err: unknown): MotivoDeExpulsion | null => {
  if (leer(err, 'code') === 'user_banned') {
    return MOTIVO_DE_EXPULSION.CUENTA_DESACTIVADA
  }
  // supabase-js lo arma sin ir a la red cuando el navegador no tiene sesión.
  if (leer(err, 'name') === 'AuthSessionMissingError') {
    return MOTIVO_DE_EXPULSION.SESION_TERMINADA
  }
  const status = leer(err, 'status')
  return typeof status === 'number' && STATUS_DE_RECHAZO.has(status)
    ? MOTIVO_DE_EXPULSION.SESION_TERMINADA
    : null
}

const verificarSesionDeConsola = async (
  supabase: SupabaseClient,
): Promise<MotivoDeExpulsion | null> => {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return motivoPorErrorDeAuth(error)
    if (!data.user) return null

    const { data: esConsola, error: errorDeRol } =
      await supabase.rpc('is_console_user')
    if (errorDeRol) return null
    return esConsola === false ? MOTIVO_DE_EXPULSION.SIN_ACCESO : null
  } catch {
    return null
  }
}

export type { MotivoDeExpulsion }
export { MOTIVO_DE_EXPULSION, verificarSesionDeConsola }
