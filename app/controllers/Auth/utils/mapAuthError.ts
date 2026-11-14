const CREDENCIALES_INVALIDAS = 'El correo o la contraseña no son correctos.'
const CUENTA_DESACTIVADA =
  'Tu cuenta está desactivada. Hablá con el administrador.'
const CORREO_SIN_CONFIRMAR = 'Todavía no confirmaste tu correo.'
const CLAVE_CORTA = 'La contraseña tiene que tener al menos 8 caracteres.'
const MISMA_CLAVE = 'La contraseña nueva tiene que ser distinta de la anterior.'
const DEMASIADOS_INTENTOS =
  'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.'
const CORREO_INVALIDO = 'Revisá el correo: no parece válido.'
const ENLACE_VENCIDO = 'El enlace venció o ya se usó. Pedí uno nuevo.'
const SIN_CONEXION =
  'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
const MENSAJE_GENERICO = 'Algo salió mal. Probá de nuevo.'

// Mapas en `Map`, nunca objeto literal: indexar un objeto con una clave que
// viene de afuera (acá, del query de /auth/error) recorre `Object.prototype`.
const MENSAJE_POR_CODE = new Map<string, string>([
  ['invalid_credentials', CREDENCIALES_INVALIDAS],
  ['user_banned', CUENTA_DESACTIVADA],
  ['email_not_confirmed', CORREO_SIN_CONFIRMAR],
  ['weak_password', CLAVE_CORTA],
  ['same_password', MISMA_CLAVE],
  ['over_email_send_rate_limit', DEMASIADOS_INTENTOS],
  ['over_request_rate_limit', DEMASIADOS_INTENTOS],
  ['email_address_invalid', CORREO_INVALIDO],
  ['validation_failed', CORREO_INVALIDO],
  ['otp_expired', ENLACE_VENCIDO],
  ['session_not_found', ENLACE_VENCIDO],
  ['session_expired', ENLACE_VENCIDO],
  ['request_timeout', SIN_CONEXION],
])

// Respaldo para los errores que supabase-js arma del lado del cliente y que
// llegan sin `code`.
const MENSAJE_POR_NAME = new Map<string, string>([
  ['AuthSessionMissingError', ENLACE_VENCIDO],
  ['AuthRetryableFetchError', SIN_CONEXION],
])

const readString = (err: unknown, key: 'code' | 'name'): string | undefined => {
  if (typeof err !== 'object' || err === null || !(key in err)) return undefined
  const value: unknown = Reflect.get(err, key)
  return typeof value === 'string' ? value : undefined
}

const mapAuthError = (err: unknown): string => {
  const porCode = MENSAJE_POR_CODE.get(readString(err, 'code') ?? '')
  if (porCode !== undefined) return porCode
  return MENSAJE_POR_NAME.get(readString(err, 'name') ?? '') ?? MENSAJE_GENERICO
}

export { CUENTA_DESACTIVADA, mapAuthError }
