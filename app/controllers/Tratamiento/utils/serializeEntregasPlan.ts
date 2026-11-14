import { SLOT_DEFINITIONS } from './slotDefinitions'

// `frase` was retired from this shape (frasesAutomaticas/epic-1, Task 1.2):
// frases are derived/read-only now, never part of the terapeuta's editable
// draft plan. See `FrasesPorSemana` (TratamientoTypes.ts) for the derived
// display data.
type SemanaContenido = {
  readonly semana: number
  readonly meditacion: string | null
  readonly mantra: string | null
  readonly egregor: string | null
  readonly cma: string | null
  readonly ic: string | null
}

type EntregaPlanInsertRow = {
  readonly semana: number
  readonly orden: number
  readonly contenido_id?: string
}

// SLOT_DEFINITIONS now holds the 5 persistable slots (meditacion, mantra,
// egregor, cma, ic) — frases are derived/automatic and never serialized here
// (see slotDefinitions.ts). No logic change here for the 2→5 widening: this
// loop already iterates SLOT_DEFINITIONS generically.
const serializeEntregasPlan = (
  semanas: ReadonlyArray<SemanaContenido>,
): EntregaPlanInsertRow[] => {
  const rows: EntregaPlanInsertRow[] = []
  for (const s of semanas) {
    for (const def of SLOT_DEFINITIONS) {
      const id = s[def.key]
      if (id === null) continue
      rows.push({ semana: s.semana, orden: def.orden, contenido_id: id })
    }
  }
  return rows
}

export type { SemanaContenido, EntregaPlanInsertRow }
export { serializeEntregasPlan }
