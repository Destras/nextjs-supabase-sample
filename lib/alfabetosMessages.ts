// Copy de los errores de alfabetos que devuelven los RPCs de alta, edición y nuevo
// tratamiento (toRpcErrorCode los reduce a `numeros_invalidos`). Fuente única para
// los tres ViewModels; vive aparte de identidadMessages porque no es de identidad.
const NUMEROS_INVALIDOS = 'Revisá los números de los alfabetos.'

// Map y no un objeto: indexar un objeto con un código crudo devolvería lo que
// herede de Object.prototype (`constructor`, `toString`, …) en vez de null.
const ALFABETOS_RPC_ERROR_MESSAGES = new Map<string, string>([
  ['numeros_invalidos', NUMEROS_INVALIDOS],
])

const mapAlfabetosRpcError = (raw: string): string | null =>
  ALFABETOS_RPC_ERROR_MESSAGES.get(raw) ?? null

export { NUMEROS_INVALIDOS, mapAlfabetosRpcError }
