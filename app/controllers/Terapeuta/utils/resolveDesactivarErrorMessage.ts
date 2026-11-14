const CODIGO_TIENE_PACIENTES = 'tiene_pacientes_activos'

const MENSAJE_GENERICO = 'No pudimos desactivar al terapeuta. Intentá de nuevo.'

// Map (y no objeto literal): el código llega del backend y un objeto indexado
// devolvería miembros de Object.prototype para claves como 'toString'.
const MENSAJE_POR_CODIGO: ReadonlyMap<string, string> = new Map([
  ['no_puede_autodesactivarse', 'No podés desactivar tu propia cuenta.'],
])

// "a cargo" y no "activos": el backend cuenta asignaciones abiertas (incluye
// pacientes pausados), y "Paciente activo" significa otra cosa en CONTEXT.md.
const buildTienePacientesMessage = (count: number): string =>
  count === 1
    ? 'Este terapeuta tiene 1 paciente a cargo y no se puede desactivar mientras lo tenga. Todavía no se puede pasar a otro terapeuta desde el panel.'
    : `Este terapeuta tiene ${count} pacientes a cargo y no se puede desactivar mientras los tenga. Todavía no se pueden pasar a otro terapeuta desde el panel.`

const resolveDesactivarErrorMessage = (
  codigo: string | null | undefined,
  count: number | null | undefined,
): string => {
  if (codigo === CODIGO_TIENE_PACIENTES) {
    return buildTienePacientesMessage(count ?? 0)
  }
  if (!codigo) return MENSAJE_GENERICO
  return MENSAJE_POR_CODIGO.get(codigo) ?? MENSAJE_GENERICO
}

export { resolveDesactivarErrorMessage }
