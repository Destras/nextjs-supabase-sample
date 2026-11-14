// Quién entra al panel (seguridadPanel / SEG-003).
//
// El panel es para terapeutas y admins ("usuarios de consola"). Los pacientes
// tienen cuenta en el mismo Supabase Auth y usan otra app: tener sesión no
// alcanza para entrar. Este módulo es la decisión, pura y sin I/O; el proxy
// (`./proxy.ts`) consulta el rol y ejecuta lo que acá se decide.

const ACCESO = {
  PASAR: 'pasar',
  IR_A_LOGIN: 'ir_a_login',
  EXPULSAR: 'expulsar',
} as const

type Acceso = (typeof ACCESO)[keyof typeof ACCESO]

interface AccesoAlPanelInput {
  readonly pathname: string
  readonly haySesion: boolean
  // true / false: lo que respondió `is_console_user`.
  // null: no se consultó, o la consulta falló.
  readonly esConsola: boolean | null
}

const RUTA_AUTH = '/auth'
const RUTA_ELEGIR_CLAVE = '/auth/update-password'

const estaBajo = (pathname: string, base: string): boolean =>
  pathname === base || pathname.startsWith(`${base}/`)

// Las pantallas de /auth/* se ven sin sesión (login, pedir la recuperación,
// verificar el link del mail, error).
const esRutaDeAuth = (pathname: string): boolean =>
  estaBajo(pathname, RUTA_AUTH)

// Todo el panel exige ser de consola. De /auth/*, solo "elegir contraseña": es
// donde termina el link de recuperación, y sin este chequeo un paciente podría
// cambiarse la contraseña de la app desde el panel.
const requiereSerConsola = (pathname: string): boolean =>
  !esRutaDeAuth(pathname) || estaBajo(pathname, RUTA_ELEGIR_CLAVE)

const decidirAccesoAlPanel = ({
  pathname,
  haySesion,
  esConsola,
}: AccesoAlPanelInput): Acceso => {
  if (!haySesion) {
    return esRutaDeAuth(pathname) ? ACCESO.PASAR : ACCESO.IR_A_LOGIN
  }
  if (!requiereSerConsola(pathname)) return ACCESO.PASAR
  // Solo un `false` explícito expulsa. `null` (la consulta falló) deja pasar:
  // un error transitorio no debe sacar a un terapeuta del panel, y los datos
  // los sigue protegiendo RLS.
  return esConsola === false ? ACCESO.EXPULSAR : ACCESO.PASAR
}

// Cookies de sesión de Supabase (`sb-<ref>-auth-token`, sus partes `.0`, `.1`
// y el `-code-verifier`). Al expulsar se borran a mano además del `signOut`,
// por si el `signOut` falla y no llega a limpiarlas.
const PATRON_COOKIE_DE_SESION = /^sb-.+-auth-token/

const cookiesDeSesion = (nombres: readonly string[]): string[] =>
  nombres.filter((nombre) => PATRON_COOKIE_DE_SESION.test(nombre))

export type { Acceso, AccesoAlPanelInput }
export { ACCESO, cookiesDeSesion, decidirAccesoAlPanel, requiereSerConsola }
