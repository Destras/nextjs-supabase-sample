import type { EtapaConEntregasRow } from './mapEtapaToTratamientoConEntregas'
import { mapEtapaToTratamientoConEntregas } from './mapEtapaToTratamientoConEntregas'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'

// The mapper imports mapContenidoRow from the Contenido barrel — mock the barrel.
// The manual frase mapper/join is not imported here: it was retired (frases
// are now auto-derived, not manually assigned content).
jest.mock('@/app/controllers/Contenido', () => ({
  mapContenidoRow: jest.fn(),
}))

import { mapContenidoRow } from '@/app/controllers/Contenido'

const baseRaw: EtapaConEntregasRow = {
  id: 'etapa-1',
  fecha_inicio: '2025-01-01',
  fecha_finalizacion: null,
  estados_etapa: { codigo: 'activa' },
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
  modalidades: { cantidad_niveles: 2 },
  entregas_plan: [],
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
  niveles: [],
}

describe('mapEtapaToTratamientoConEntregas', () => {
  let raw: EtapaConEntregasRow

  beforeEach(() => {
    raw = { ...baseRaw, entregas_plan: [] }
  })

  it('groups offsets 0, 1, 3 into semana 1 and offset 7 into semana 2 and offset 14 into semana 3', () => {
    const videoContenido = {
      id: 'c-video',
      tipo: 'VIDEO',
      titulo: 'Video',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }
    const audioContenido = {
      id: 'c-audio',
      tipo: 'AUDIO',
      titulo: 'Audio',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }
    const videoS2 = {
      id: 'c-video-s2',
      tipo: 'VIDEO',
      titulo: 'Video S2',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }
    const videoS3 = {
      id: 'c-video-s3',
      tipo: 'VIDEO',
      titulo: 'Video S3',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }

    // Orden de mapeo del mapper: row 0 (video), row 1 (audio), row 7 (videoS2),
    // row 14 (videoS3).
    ;(mapContenidoRow as jest.Mock)
      .mockReturnValueOnce(videoContenido)
      .mockReturnValueOnce(audioContenido)
      .mockReturnValueOnce(videoS2)
      .mockReturnValueOnce(videoS3)

    const rawWithEntregas: EtapaConEntregasRow = {
      ...raw,
      entregas_plan: [
        {
          dia_offset: 0,
          orden: 1,
          contenido: {
            id: 'c-video',
            tipo: 'VIDEO',
            titulo: 'Video',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
        {
          dia_offset: 1,
          orden: 2,
          contenido: {
            id: 'c-audio',
            tipo: 'AUDIO',
            titulo: 'Audio',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
        {
          dia_offset: 7,
          orden: 1,
          contenido: {
            id: 'c-video-s2',
            tipo: 'VIDEO',
            titulo: 'Video S2',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
        {
          dia_offset: 14,
          orden: 1,
          contenido: {
            id: 'c-video-s3',
            tipo: 'VIDEO',
            titulo: 'Video S3',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
      ],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWithEntregas)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [videoContenido, audioContenido],
          },
          {
            id: 'semana-2',
            numeroSemana: 2,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [videoS2],
          },
          {
            id: 'semana-3',
            numeroSemana: 3,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [videoS3],
          },
        ],
      },
      semanasTotales: 8,
      cantidadNiveles: 2,
      frasesPorSemana: {},
    })
  })

  it('omits a row whose contenido join is null without breaking the rest', () => {
    const videoContenido = {
      id: 'c-video',
      tipo: 'VIDEO',
      titulo: 'Video',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }

    ;(mapContenidoRow as jest.Mock).mockReturnValueOnce(videoContenido)

    const rawWithNullJoin: EtapaConEntregasRow = {
      ...raw,
      entregas_plan: [
        { dia_offset: 0, orden: 1, contenido: null },
        {
          dia_offset: 1,
          orden: 2,
          contenido: {
            id: 'c-video',
            tipo: 'VIDEO',
            titulo: 'Video',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
      ],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWithNullJoin)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [videoContenido],
          },
        ],
      },
      semanasTotales: 8,
      cantidadNiveles: 2,
      frasesPorSemana: {},
    })
  })

  it('omits a row with unsupported tipo without breaking the rest', () => {
    const videoContenido = {
      id: 'c-video',
      tipo: 'VIDEO',
      titulo: 'Video',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }

    ;(mapContenidoRow as jest.Mock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(videoContenido)

    const rawWithBadTipo: EtapaConEntregasRow = {
      ...raw,
      entregas_plan: [
        {
          dia_offset: 0,
          orden: 1,
          contenido: {
            id: 'c-bad',
            tipo: 'DESCONOCIDO',
            titulo: 'Bad',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
        {
          dia_offset: 1,
          orden: 2,
          contenido: {
            id: 'c-video',
            tipo: 'VIDEO',
            titulo: 'Video',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
      ],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWithBadTipo)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [videoContenido],
          },
        ],
      },
      semanasTotales: 8,
      cantidadNiveles: 2,
      frasesPorSemana: {},
    })
  })

  it('resolves collision by keeping the row with the lowest (orden, dia_offset)', () => {
    const firstVideo = {
      id: 'c-video-first',
      tipo: 'VIDEO',
      titulo: 'First Video',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }
    const secondVideo = {
      id: 'c-video-second',
      tipo: 'VIDEO',
      titulo: 'Second Video',
      descripcion: null,
      recursoRef: null,
      duracion: null,
    }

    ;(mapContenidoRow as jest.Mock)
      .mockReturnValueOnce(secondVideo)
      .mockReturnValueOnce(firstVideo)

    // orden 2 / dia 5 vs orden 1 / dia 6 — orden 1 wins even though dia is later
    const rawWithCollision: EtapaConEntregasRow = {
      ...raw,
      entregas_plan: [
        {
          dia_offset: 5,
          orden: 2,
          contenido: {
            id: 'c-video-second',
            tipo: 'VIDEO',
            titulo: 'Second Video',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
        {
          dia_offset: 6,
          orden: 1,
          contenido: {
            id: 'c-video-first',
            tipo: 'VIDEO',
            titulo: 'First Video',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        },
      ],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWithCollision)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [firstVideo, secondVideo],
          },
        ],
      },
      semanasTotales: 8,
      cantidadNiveles: 2,
      frasesPorSemana: {},
    })
  })

  // semanasTotales sale ÚNICAMENTE de cantidad_niveles * 4. cantidad_sesiones ya
  // no forma parte del contrato del row (EtapaConEntregasRow), así que es imposible
  // por construcción que influya en las semanas.
  it('derives semanasTotales from cantidad_niveles * 4 (4 niveles → 16 semanas)', () => {
    const rawWith4Niveles: EtapaConEntregasRow = {
      ...raw,
      modalidades: { cantidad_niveles: 4 },
      entregas_plan: [],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWith4Niveles)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [],
      },
      semanasTotales: 16,
      cantidadNiveles: 4,
      frasesPorSemana: {},
    })
  })

  it('scales semanasTotales with cantidad_niveles (8 niveles → 32 semanas)', () => {
    const rawWith8Niveles: EtapaConEntregasRow = {
      ...raw,
      modalidades: { cantidad_niveles: 8 },
      entregas_plan: [],
    }

    expect(mapEtapaToTratamientoConEntregas(rawWith8Niveles)).toEqual({
      tratamiento: {
        ...baseTratamiento,
        entregasSemanales: [],
      },
      semanasTotales: 32,
      cantidadNiveles: 8,
      frasesPorSemana: {},
    })
  })

  it('returns tratamiento null when causa is missing', () => {
    const rawNoCausa: EtapaConEntregasRow = {
      ...raw,
      causas: null,
    }

    expect(mapEtapaToTratamientoConEntregas(rawNoCausa)).toEqual({
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
    })
  })

  // ---------------------------------------------------------------------
  // frasesPorSemana — widened independent of entregas_plan (Task 1.2 fix to
  // the Task 0.4 gap: a week with zero entregas_plan rows still needs its
  // derived frases surfaced, since the main asignador use case is building a
  // still-empty 16-week plan).
  // ---------------------------------------------------------------------

  it('returns frasesPorSemana keyed by semana even for a week with zero entregas_plan rows', () => {
    // No entregas_plan at all — the etapa's plan is still empty (the main
    // asignador use case), yet the RPC already has frases for every week.
    const frasesPorSemanaRaw = [
      {
        semana: 1,
        frases: [
          { orden: 1, origen: 'causa' as const, texto: 'Causa frase 1' },
          { orden: 2, origen: 'algoritmo' as const, texto: 'Algoritmo 1' },
          { orden: 3, origen: 'causa' as const, texto: 'Causa frase 2' },
        ],
      },
      {
        semana: 2,
        frases: [
          { orden: 1, origen: 'causa' as const, texto: 'Causa frase 3' },
          { orden: 2, origen: 'algoritmo' as const, texto: 'Algoritmo 1' },
          { orden: 3, origen: 'causa' as const, texto: 'Causa frase 4' },
        ],
      },
    ]

    const result = mapEtapaToTratamientoConEntregas(raw, frasesPorSemanaRaw)

    expect(result.frasesPorSemana).toEqual({
      1: frasesPorSemanaRaw[0]?.frases,
      2: frasesPorSemanaRaw[1]?.frases,
    })
  })

  it('defaults frasesPorSemana to {} when no frasesPorSemanaRaw argument is passed', () => {
    const result = mapEtapaToTratamientoConEntregas(raw)

    expect(result.frasesPorSemana).toEqual({})
  })
})
