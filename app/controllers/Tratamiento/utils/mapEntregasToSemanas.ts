import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import type { EntregaSemanal } from '../TratamientoTypes'
import type { SemanaContenido } from './serializeEntregasPlan'

/**
 * Builds a ReadonlyArray<SemanaContenido> of length `semanasTotales` from the
 * entregasSemanales of a tratamiento. Slots not present in the entregas are
 * left as null. Pure function — no side effects.
 */
const mapEntregasToSemanas = (
  entregasSemanales: ReadonlyArray<EntregaSemanal>,
  semanasTotales: number,
): ReadonlyArray<SemanaContenido> => {
  return Array.from({ length: semanasTotales }, (_, i) => {
    const n = i + 1
    const entrega = entregasSemanales.find((e) => e.numeroSemana === n)
    const contenidos = entrega?.contenido ?? []

    const video = contenidos.find((c) => c.tipo === TIPO_CONTENIDO.VIDEO)
    const audio = contenidos.find((c) => c.tipo === TIPO_CONTENIDO.AUDIO)
    const egregor = contenidos.find((c) => c.tipo === TIPO_CONTENIDO.EGREGOR)
    const cma = contenidos.find((c) => c.tipo === TIPO_CONTENIDO.CMA)
    const ic = contenidos.find((c) => c.tipo === TIPO_CONTENIDO.IC)

    return {
      semana: n,
      meditacion: video?.id ?? null,
      mantra: audio?.id ?? null,
      egregor: egregor?.id ?? null,
      cma: cma?.id ?? null,
      ic: ic?.id ?? null,
    }
  })
}

export { mapEntregasToSemanas }
