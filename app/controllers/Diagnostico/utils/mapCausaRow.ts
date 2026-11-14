import type { AllDiagnosticos } from '../DiagnosticoTypes'
import type { EtapaRowRaw } from './mapEtapasRows'
import { mapEtapasRows } from './mapEtapasRows'

type Causa = AllDiagnosticos['causa'][number]

interface CausaRowRaw {
  id: string
  codigo: string
  nombre: string
  definicion: string | null
  emociones_esperadas: string | null
  activo: boolean
  causa_etapas: EtapaRowRaw[]
}

const parseEmocionesEsperadas = (raw: string | null): string[] => {
  if (raw === null) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const mapCausaRow = (raw: CausaRowRaw): Causa => ({
  id: raw.id,
  codigo: raw.codigo,
  nombre: raw.nombre,
  definicion: raw.definicion ?? '',
  emocionesEsperadas: parseEmocionesEsperadas(raw.emociones_esperadas),
  activo: raw.activo,
  etapas: mapEtapasRows(raw.causa_etapas),
})

export type { CausaRowRaw }
export { mapCausaRow, parseEmocionesEsperadas }
