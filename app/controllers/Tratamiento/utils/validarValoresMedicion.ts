import type { CampoMedicion } from '../TratamientoTypes'

// Validación por campo del formulario de medición, en el mismo shape (string)
// que produce un <input type="number">. Pura y compartida por el tab de
// Estructura y por FinalizarTratamientoDialog (design §4.2) — ambos
// construyen sus `campos` con construirCampos (PR3) y llaman a este util
// antes de habilitar el submit.
const validarValoresMedicion = (
  valores: Record<string, string>,
  campos: ReadonlyArray<CampoMedicion>,
): Record<string, string> => {
  const errores: Record<string, string> = {}

  for (const campo of campos) {
    const raw = valores[campo.key]
    const trimmed = raw?.trim() ?? ''

    if (trimmed === '') {
      errores[campo.key] = 'Este campo es obligatorio.'
      continue
    }

    const num = Number(trimmed)
    if (Number.isNaN(num)) {
      errores[campo.key] = 'Ingresá un valor numérico.'
      continue
    }

    if (!Number.isInteger(num)) {
      errores[campo.key] = 'Ingresá un número entero (sin decimales).'
      continue
    }

    if (num < 0 || num > 100) {
      errores[campo.key] = 'El valor debe estar entre 0 y 100.'
    }
  }

  return errores
}

export { validarValoresMedicion }
