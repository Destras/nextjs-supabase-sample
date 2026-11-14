import { mapEtapaToTratamiento } from './mapEtapaToTratamiento'
import type { EtapaTratamientoRaw } from './mapEtapaToTratamiento'
import type { Tratamiento, Nivel, Evaluacion } from '../TratamientoTypes'

interface NivelEvaluacionRow {
  readonly id: string
  readonly score: number
  readonly fecha_respuesta: string
}

interface NivelRow {
  readonly id: string
  readonly numero_nivel: number
  readonly fecha_seguimiento_esperada: string | null
  readonly fecha_seguimiento_real: string | null
  readonly observaciones: string | null
  // nivel_evaluacion.nivel_id is a UNIQUE FK, so PostgREST embeds the related
  // row as a single object (or null when none exists), not an array.
  readonly nivel_evaluacion: NivelEvaluacionRow | null
}

interface EtapaConNivelesRow extends EtapaTratamientoRaw {
  readonly niveles: ReadonlyArray<NivelRow>
}

const mapNivelEvaluacionRow = (row: NivelEvaluacionRow): Evaluacion => ({
  id: row.id,
  score: row.score,
  fechaRespuesta: row.fecha_respuesta,
})

const mapNivelRow = (row: NivelRow): Nivel => {
  const evaluacionRow = row.nivel_evaluacion ?? null
  return {
    id: row.id,
    numeroNivel: row.numero_nivel,
    fechaSeguimientoEsperado: row.fecha_seguimiento_esperada,
    fechaSeguimientoReal: row.fecha_seguimiento_real,
    observaciones: row.observaciones,
    evaluacion:
      evaluacionRow === null ? null : mapNivelEvaluacionRow(evaluacionRow),
  }
}

const mapEtapaToTratamientoConNiveles = (
  raw: EtapaConNivelesRow,
): Tratamiento | null => {
  const base = mapEtapaToTratamiento(raw)
  if (base === null) {
    return null
  }
  return {
    ...base,
    niveles: raw.niveles.map(mapNivelRow),
    entregasSemanales: [],
  }
}

export type { EtapaConNivelesRow }
export { mapEtapaToTratamientoConNiveles }
