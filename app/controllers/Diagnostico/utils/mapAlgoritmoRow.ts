import type { AllDiagnosticos } from '../DiagnosticoTypes'
import type { EtapaRowRaw } from './mapEtapasRows'
import { mapEtapasRows } from './mapEtapasRows'

type Algoritmo = AllDiagnosticos['algoritmo'][number]

interface AlgoritmoRowRaw {
  id: string
  codigo: string
  nombre: string
  definicion: string | null
  comportamiento: string | null
  activo: boolean
  algoritmo_etapas: EtapaRowRaw[]
}

const COMPORTAMIENTO_BADGE_MAX = 40

const truncateComportamiento = (raw: string): string =>
  raw.length > COMPORTAMIENTO_BADGE_MAX
    ? `${raw.slice(0, COMPORTAMIENTO_BADGE_MAX)}…`
    : raw

const mapAlgoritmoRow = (raw: AlgoritmoRowRaw): Algoritmo => {
  const comportamiento = raw.comportamiento ?? ''
  return {
    id: raw.id,
    codigo: raw.codigo,
    nombre: raw.nombre,
    definicion: raw.definicion ?? '',
    comportamiento,
    comportamientoBadge: truncateComportamiento(comportamiento),
    activo: raw.activo,
    etapas: mapEtapasRows(raw.algoritmo_etapas),
  }
}

export type { AlgoritmoRowRaw }
export { mapAlgoritmoRow, truncateComportamiento }
