import type { CampoMedicion } from '../TratamientoTypes'

// Wire shape of `p_valores`, pinned by design part 1 §1.1 — kept verbatim,
// consumed as-is by registrarMedicion / editarMedicion / cerrarEtapaConMedicion.
interface ValoresMedicionWire {
  readonly estructura_general: number
  readonly centros: ReadonlyArray<{
    readonly centro_id: string
    readonly valor: number
  }>
}

// Converts the therapist's typed form state (string values, keyed by
// CampoMedicion.key) into the `p_valores` jsonb the write RPCs expect. Shared
// by the Estructura tab and FinalizarTratamientoDialog (design §4.2) — both
// need a byte-identical wire shape.
const serializeValoresMedicion = (
  valores: Record<string, string>,
  campos: ReadonlyArray<CampoMedicion>,
): ValoresMedicionWire => {
  let estructuraGeneral = 0
  const centros: { centro_id: string; valor: number }[] = []

  for (const campo of campos) {
    const num = Number(valores[campo.key])
    if (campo.centroId === null) {
      estructuraGeneral = num
    } else {
      centros.push({ centro_id: campo.centroId, valor: num })
    }
  }

  return { estructura_general: estructuraGeneral, centros }
}

export type { ValoresMedicionWire }
export { serializeValoresMedicion }
