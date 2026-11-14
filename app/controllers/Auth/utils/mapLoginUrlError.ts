import { CUENTA_DESACTIVADA } from './mapAuthError'

// Mensajes que el login muestra según el `?error=` de su URL. El parámetro lo
// escribe el proxy al rechazar una sesión (lib/supabase/proxy.ts) y el shell al
// detectar que la sesión dejó de valer (useExpulsarSesionInvalida), pero viene
// de la URL: cualquiera puede armar el link. Solo se traducen códigos
// conocidos; cualquier otro valor no muestra nada (nunca se refleja el texto).
//
// En `Map`, no objeto literal: indexar un objeto con una clave que viene de
// afuera recorre `Object.prototype`.
const MENSAJE_POR_CODIGO = new Map<string, string>([
  [
    'sin_acceso',
    'Esta cuenta no tiene acceso al panel. Si sos paciente, usá la app.',
  ],
  // No se sabe por qué terminó (desactivación, sesión vencida o cerrada desde
  // otro lado): el texto es cierto en todos los casos. Si la causa fue una
  // desactivación, el próximo intento de login lo dice (`user_banned`).
  [
    'sesion_terminada',
    'Tu sesión terminó. Volvé a entrar; si no podés, hablá con el administrador.',
  ],
  ['cuenta_desactivada', CUENTA_DESACTIVADA],
])

const mapLoginUrlError = (codigo: string | null): string | null =>
  MENSAJE_POR_CODIGO.get(codigo ?? '') ?? null

export { mapLoginUrlError }
