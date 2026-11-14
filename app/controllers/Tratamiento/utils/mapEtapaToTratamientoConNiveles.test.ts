import type { EtapaConNivelesRow } from './mapEtapaToTratamientoConNiveles'
import { mapEtapaToTratamientoConNiveles } from './mapEtapaToTratamientoConNiveles'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'

const baseRaw: EtapaConNivelesRow = {
  id: 'etapa-1',
  fecha_inicio: '2025-01-01',
  fecha_finalizacion: null,
  estados_etapa: { codigo: 'activo' },
  causas: {
    id: 'causa-1',
    codigo: 'C01',
    nombre: 'Causa 1',
    definicion: 'def',
    emociones_esperadas: 'emo',
    activo: true,
  },
  algoritmos: {
    id: 'algo-1',
    codigo: 'A01',
    nombre: 'Algo 1',
    definicion: 'def',
    comportamiento: 'beh',
    activo: true,
  },
  etapa_bloqueos: [],
  niveles: [],
}

const baseTratamiento = {
  id: 'etapa-1',
  fechaInicio: '2025-01-01',
  fechaFin: null,
  estado: TRATAMIENTO_STATE.ACTIVO,
  diagnostico: {
    causa: {
      id: 'causa-1',
      codigo: 'C01',
      nombre: 'Causa 1',
      definicion: 'def',
      emocionesEsperadas: ['emo'],
      activo: true,
      etapas: [],
    },
    algoritmo: {
      id: 'algo-1',
      codigo: 'A01',
      nombre: 'Algo 1',
      definicion: 'def',
      comportamiento: 'beh',
      comportamientoBadge: 'beh',
      activo: true,
      etapas: [],
    },
    bloqueos: [],
  },
  entregasSemanales: [],
}

describe('mapEtapaToTratamientoConNiveles', () => {
  let raw: EtapaConNivelesRow

  beforeEach(() => {
    raw = { ...baseRaw, niveles: [] }
  })

  it('returns nivel.evaluacion populated when nivel_evaluacion row is present', () => {
    const rawWithNivel: EtapaConNivelesRow = {
      ...raw,
      niveles: [
        {
          id: 'nivel-1',
          numero_nivel: 1,
          fecha_seguimiento_esperada: '2025-02-01',
          fecha_seguimiento_real: '2025-02-02',
          observaciones: 'ok',
          // nivel_evaluacion.nivel_id is UNIQUE, so PostgREST embeds it as a
          // single object (not an array) when a related row exists.
          nivel_evaluacion: {
            id: 'eval-1',
            score: 8,
            fecha_respuesta: '2025-02-02',
          },
        },
      ],
    }
    expect(mapEtapaToTratamientoConNiveles(rawWithNivel)).toEqual({
      ...baseTratamiento,
      niveles: [
        {
          id: 'nivel-1',
          numeroNivel: 1,
          fechaSeguimientoEsperado: '2025-02-01',
          fechaSeguimientoReal: '2025-02-02',
          observaciones: 'ok',
          evaluacion: { id: 'eval-1', score: 8, fechaRespuesta: '2025-02-02' },
        },
      ],
    })
  })

  it('returns nivel.evaluacion as null when nivel_evaluacion is null', () => {
    const rawWithNivel: EtapaConNivelesRow = {
      ...raw,
      niveles: [
        {
          id: 'nivel-null',
          numero_nivel: 3,
          fecha_seguimiento_esperada: '2025-04-01',
          fecha_seguimiento_real: null,
          observaciones: null,
          // Supabase returns null (not []) when no related row exists in some cases
          nivel_evaluacion: null,
        },
      ],
    }
    expect(mapEtapaToTratamientoConNiveles(rawWithNivel)).toEqual({
      ...baseTratamiento,
      niveles: [
        {
          id: 'nivel-null',
          numeroNivel: 3,
          fechaSeguimientoEsperado: '2025-04-01',
          fechaSeguimientoReal: null,
          observaciones: null,
          evaluacion: null,
        },
      ],
    })
  })

  it('hydrates each nivel independently in a mixed array', () => {
    const rawWithNiveles: EtapaConNivelesRow = {
      ...raw,
      niveles: [
        {
          id: 'nivel-1',
          numero_nivel: 1,
          fecha_seguimiento_esperada: '2025-02-01',
          fecha_seguimiento_real: '2025-02-02',
          observaciones: 'first',
          // Single object when present (unique FK → one-to-one embed)
          nivel_evaluacion: {
            id: 'eval-1',
            score: 9,
            fecha_respuesta: '2025-02-02',
          },
        },
        {
          id: 'nivel-2',
          numero_nivel: 2,
          fecha_seguimiento_esperada: '2025-03-01',
          fecha_seguimiento_real: null,
          observaciones: null,
          // null when no related row exists
          nivel_evaluacion: null,
        },
      ],
    }
    expect(mapEtapaToTratamientoConNiveles(rawWithNiveles)).toEqual({
      ...baseTratamiento,
      niveles: [
        {
          id: 'nivel-1',
          numeroNivel: 1,
          fechaSeguimientoEsperado: '2025-02-01',
          fechaSeguimientoReal: '2025-02-02',
          observaciones: 'first',
          evaluacion: { id: 'eval-1', score: 9, fechaRespuesta: '2025-02-02' },
        },
        {
          id: 'nivel-2',
          numeroNivel: 2,
          fechaSeguimientoEsperado: '2025-03-01',
          fechaSeguimientoReal: null,
          observaciones: null,
          evaluacion: null,
        },
      ],
    })
  })

  it('returns empty niveles array when etapa has no niveles', () => {
    expect(mapEtapaToTratamientoConNiveles(raw)).toEqual({
      ...baseTratamiento,
      niveles: [],
    })
  })

  it('returns base tratamiento fields from mapEtapaToTratamiento (id, fechaInicio, diagnostico, estado)', () => {
    expect(mapEtapaToTratamientoConNiveles(raw)).toEqual({
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: null,
      estado: TRATAMIENTO_STATE.ACTIVO,
      diagnostico: {
        causa: {
          id: 'causa-1',
          codigo: 'C01',
          nombre: 'Causa 1',
          definicion: 'def',
          emocionesEsperadas: ['emo'],
          activo: true,
          etapas: [],
        },
        algoritmo: {
          id: 'algo-1',
          codigo: 'A01',
          nombre: 'Algo 1',
          definicion: 'def',
          comportamiento: 'beh',
          comportamientoBadge: 'beh',
          activo: true,
          etapas: [],
        },
        bloqueos: [],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })
})
