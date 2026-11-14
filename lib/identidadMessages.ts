// Copy del paso de identidad (DevSpec §7, activacionPorTelefono) y traducción de los
// códigos crudos que devuelven los RPCs (register_paciente, update_paciente_identidad)
// a mensajes legibles. Fuente única para no duplicar el copy entre validators.ts y los
// ViewModels de alta/edición.
// El '+54' lo pone el campo como prefijo fijo (ACT-001), así que la instrucción
// describe exactamente lo que hay que tipear. La segunda frase es sobre todo para
// el lector de pantalla, que no ve el prefijo.
const AYUDA_TELEFONO =
  'Código de área y número, sin el 0 ni el 15. El +54 ya está puesto.'

const TELEFONO_INVALIDO =
  'Teléfono inválido: tiene que ser un número argentino, con código de área y sin el 0 ni el 15.'

const TELEFONO_REQUERIDO = 'El teléfono es requerido'

const FECHA_NACIMIENTO_REQUERIDA = 'La fecha de nacimiento es requerida.'

const AVISO_TELEFONO_DUPLICADO =
  'Este teléfono ya está en otra ficha. Con un teléfono compartido, el paciente no va a poder activar la app solo. Si tiene un número propio, usá ese.'

// Email duplicado (ADR 0010). El genérico es el que ve el terapeuta cuando la ficha
// que tiene el email no es suya: no nombra a nadie.
const EMAIL_DUPLICADO =
  'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.'

// Prefijo del aviso que SÍ nombra la ficha (cuando es propia). Va separado del nombre
// porque la vista arma el nombre como link a esa ficha.
const EMAIL_EN_FICHA_DE = 'Ese email ya está en la ficha de'

const PACIENTE_DADO_DE_BAJA =
  'Ese email pertenece a un paciente que se dio de baja, así que no se puede usar en otra ficha.'

// Email bloqueado (BETA-030): una vez que el paciente activó su cuenta, el email de
// la ficha no se puede cambiar desde la edición. Ninguno de los dos textos dice
// "con este email": hay fichas ya desincronizadas del login, donde sería falso.
const AYUDA_EMAIL_BLOQUEADO =
  'El paciente ya activó su cuenta, así que el email no se puede cambiar desde acá.'

const EMAIL_BLOQUEADO_POR_CUENTA =
  'No se puede cambiar el email: el paciente ya activó su cuenta.'

// Map y no un objeto: indexar un objeto con un código crudo devolvería lo que
// herede de Object.prototype (`constructor`, `toString`, …) en vez de null.
const RPC_ERROR_MESSAGES = new Map<string, string>([
  ['telefono_invalido', TELEFONO_INVALIDO],
  ['telefono_requerido', TELEFONO_REQUERIDO],
  ['fecha_nacimiento_requerida', FECHA_NACIMIENTO_REQUERIDA],
  ['paciente_dado_de_baja', PACIENTE_DADO_DE_BAJA],
  ['email_duplicado', EMAIL_DUPLICADO],
  ['email_bloqueado_por_cuenta', EMAIL_BLOQUEADO_POR_CUENTA],
])

const mapIdentidadRpcError = (raw: string): string | null =>
  RPC_ERROR_MESSAGES.get(raw) ?? null

interface FichaConEmail {
  readonly id: string
  readonly nombre: string
  readonly dadoDeBaja: boolean
  readonly accesible: boolean
}

// `accesible: false` solo le llega a la vista de un admin: la ficha no tiene ninguna
// asignación abierta, así que se nombra SIN link, para no mandarlo a un "sin acceso".
interface FichaDuplicada {
  readonly id: string
  readonly nombre: string
  readonly accesible: boolean
}

interface AvisoEmailDuplicado {
  readonly mensaje: string
  readonly fichaDuplicada: FichaDuplicada | null
}

// Decide qué ve quien pregunta tras un `email_duplicado`, según la ficha que las RLS
// le dejaron encontrar (ADR 0010).
// - `null` = no la ve (o no existe) → genérico, sin nombre.
// - Terapeuta sin asignación ABIERTA con ese paciente (`accesible: false`) → genérico
//   también: las RLS de `pacientes` no miran `fecha_hasta` y devuelven a sus
//   ex-pacientes, pero esa ficha ya no es suya (BETA-034). Vale igual si está dada
//   de baja.
// - `veTodasLasFichas` (admin): las RLS le muestran todo, así que siempre se nombra.
// - Dada de baja → mensaje de baja, sin link: el RPC de edición no tiene el guard de
//   baja que sí tiene el alta, así que ese caso llega por acá.
const resolverEmailDuplicado = (
  ficha: FichaConEmail | null,
  veTodasLasFichas: boolean,
): AvisoEmailDuplicado => {
  if (ficha === null) return { mensaje: EMAIL_DUPLICADO, fichaDuplicada: null }
  if (!veTodasLasFichas && !ficha.accesible)
    return { mensaje: EMAIL_DUPLICADO, fichaDuplicada: null }
  if (ficha.dadoDeBaja)
    return { mensaje: PACIENTE_DADO_DE_BAJA, fichaDuplicada: null }
  return {
    mensaje: `${EMAIL_EN_FICHA_DE} ${ficha.nombre}`,
    fichaDuplicada: {
      id: ficha.id,
      nombre: ficha.nombre,
      accesible: ficha.accesible,
    },
  }
}

export type { AvisoEmailDuplicado, FichaDuplicada }
export {
  EMAIL_DUPLICADO,
  EMAIL_EN_FICHA_DE,
  PACIENTE_DADO_DE_BAJA,
  resolverEmailDuplicado,
  AYUDA_TELEFONO,
  AYUDA_EMAIL_BLOQUEADO,
  TELEFONO_INVALIDO,
  TELEFONO_REQUERIDO,
  FECHA_NACIMIENTO_REQUERIDA,
  AVISO_TELEFONO_DUPLICADO,
  mapIdentidadRpcError,
}
