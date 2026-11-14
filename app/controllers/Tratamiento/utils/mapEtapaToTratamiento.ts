import type { Tratamiento } from '../TratamientoTypes'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import { parseEmocionesEsperadas } from '@/app/controllers/Diagnostico/utils/mapCausaRow'
import { truncateComportamiento } from '@/app/controllers/Diagnostico/utils/mapAlgoritmoRow'

interface CausaRaw {
  id: string
  codigo: string
  nombre: string
  definicion: string | null
  emociones_esperadas: string | null
  activo: boolean
}

interface AlgoritmoRaw {
  id: string
  codigo: string
  nombre: string
  definicion: string | null
  comportamiento: string | null
  activo: boolean
}

interface BloqueoRaw {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

interface EtapaTratamientoRaw {
  id: string
  fecha_inicio: string | null
  fecha_finalizacion: string | null
  estados_etapa: { codigo: string } | null
  causas: CausaRaw | null
  algoritmos: AlgoritmoRaw | null
  etapa_bloqueos: Array<{ bloqueos: BloqueoRaw | null }>
}

const resolveEstado = (
  codigo: string | undefined,
  fechaFinalizacion: string | null,
): TRATAMIENTO_STATE => {
  if (codigo === TRATAMIENTO_STATE.ACTIVO) return TRATAMIENTO_STATE.ACTIVO
  if (codigo === TRATAMIENTO_STATE.FINALIZADO)
    return TRATAMIENTO_STATE.FINALIZADO
  if (codigo === TRATAMIENTO_STATE.SUSPENDIDO)
    return TRATAMIENTO_STATE.SUSPENDIDO
  return fechaFinalizacion === null
    ? TRATAMIENTO_STATE.ACTIVO
    : TRATAMIENTO_STATE.FINALIZADO
}

const mapEtapaToTratamiento = (
  raw: EtapaTratamientoRaw,
): Tratamiento | null => {
  // A missing causa/algoritmo join means the etapa is unusable (FK orphan /
  // RLS-hidden) — skip it. fecha_inicio null is NOT that case: it means the
  // etapa exists but has not started yet (DEC-3, inicioTratamiento Epic 0/1).
  // That etapa IS a Tratamiento — it is precisely the one that needs to be
  // loaded with content so it can start (INI-001).
  if (!raw.causas || !raw.algoritmos) {
    return null
  }

  const bloqueos = raw.etapa_bloqueos
    .map((row) => row.bloqueos)
    .filter((b): b is BloqueoRaw => b !== null)
    .map((b) => ({
      id: b.id,
      codigo: b.codigo,
      nombre: b.nombre,
      descripcion: b.descripcion ?? '',
      activo: b.activo,
    }))

  return {
    id: raw.id,
    fechaInicio: raw.fecha_inicio,
    fechaFin: raw.fecha_finalizacion,
    estado: resolveEstado(raw.estados_etapa?.codigo, raw.fecha_finalizacion),
    diagnostico: {
      causa: {
        id: raw.causas.id,
        codigo: raw.causas.codigo,
        nombre: raw.causas.nombre,
        definicion: raw.causas.definicion ?? '',
        emocionesEsperadas: parseEmocionesEsperadas(
          raw.causas.emociones_esperadas,
        ),
        activo: raw.causas.activo,
        etapas: [],
      },
      algoritmo: (() => {
        const comportamiento = raw.algoritmos.comportamiento ?? ''
        return {
          id: raw.algoritmos.id,
          codigo: raw.algoritmos.codigo,
          nombre: raw.algoritmos.nombre,
          definicion: raw.algoritmos.definicion ?? '',
          comportamiento,
          comportamientoBadge: truncateComportamiento(comportamiento),
          activo: raw.algoritmos.activo,
          etapas: [],
        }
      })(),
      bloqueos,
    },
    niveles: [],
    entregasSemanales: [],
  }
}

export type { EtapaTratamientoRaw }
export { mapEtapaToTratamiento }
