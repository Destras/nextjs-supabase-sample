import type { EtapaTratamientoRaw } from './mapEtapaToTratamiento'
import { mapEtapaToTratamiento } from './mapEtapaToTratamiento'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'

describe('mapEtapaToTratamiento', () => {
  let raw: EtapaTratamientoRaw

  beforeEach(() => {
    raw = {
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
      etapa_bloqueos: [
        {
          bloqueos: {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        },
      ],
    }
  })

  it('returns the mapped Tratamiento shell with full diagnostico', () => {
    expect(mapEtapaToTratamiento(raw)).toEqual({
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('maps codigo "finalizado" to TRATAMIENTO_STATE.FINALIZADO', () => {
    raw.estados_etapa = { codigo: 'finalizado' }
    raw.fecha_finalizacion = '2025-04-01'
    expect(mapEtapaToTratamiento(raw)).toEqual({
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: '2025-04-01',
      estado: TRATAMIENTO_STATE.FINALIZADO,
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('maps codigo "suspendido" to TRATAMIENTO_STATE.SUSPENDIDO', () => {
    raw.estados_etapa = { codigo: 'suspendido' }
    expect(mapEtapaToTratamiento(raw)).toEqual({
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: null,
      estado: TRATAMIENTO_STATE.SUSPENDIDO,
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('defaults unknown codigo to ACTIVO when fecha_finalizacion is null', () => {
    raw.estados_etapa = { codigo: 'whatever' }
    raw.fecha_finalizacion = null
    expect(mapEtapaToTratamiento(raw)).toEqual({
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('defaults unknown codigo to FINALIZADO when fecha_finalizacion is set', () => {
    raw.estados_etapa = { codigo: 'whatever' }
    raw.fecha_finalizacion = '2025-04-01'
    expect(mapEtapaToTratamiento(raw)).toEqual({
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: '2025-04-01',
      estado: TRATAMIENTO_STATE.FINALIZADO,
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('returns null when causas is null (FK orphan / RLS-hidden)', () => {
    raw.causas = null
    expect(mapEtapaToTratamiento(raw)).toBeNull()
  })

  it('returns the mapped Tratamiento with fechaInicio null when the etapa never started (pendiente)', () => {
    raw.fecha_inicio = null
    raw.estados_etapa = { codigo: 'pendiente' }
    expect(mapEtapaToTratamiento(raw)).toEqual({
      id: 'etapa-1',
      fechaInicio: null,
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
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B01',
            nombre: 'Bloqueo 1',
            descripcion: 'desc',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('returns null when algoritmos is null', () => {
    raw.algoritmos = null
    expect(mapEtapaToTratamiento(raw)).toBeNull()
  })

  it('filters out etapa_bloqueos entries whose bloqueos join is null', () => {
    raw.etapa_bloqueos = [
      { bloqueos: null },
      {
        bloqueos: {
          id: 'b-2',
          codigo: 'B02',
          nombre: 'Bloqueo 2',
          descripcion: 'd',
          activo: true,
        },
      },
    ]
    expect(mapEtapaToTratamiento(raw)).toEqual({
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
        bloqueos: [
          {
            id: 'b-2',
            codigo: 'B02',
            nombre: 'Bloqueo 2',
            descripcion: 'd',
            activo: true,
          },
        ],
      },
      niveles: [],
      entregasSemanales: [],
    })
  })

  it('returns empty bloqueos array when etapa_bloqueos is empty', () => {
    raw.etapa_bloqueos = []
    expect(mapEtapaToTratamiento(raw)).toEqual({
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
