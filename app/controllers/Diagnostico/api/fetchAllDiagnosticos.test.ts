import { createClient } from '@/lib/supabase/client'
import { fetchAllDiagnosticos } from './fetchAllDiagnosticos'

jest.mock('@/lib/supabase/client')

describe('fetchAllDiagnosticos', () => {
  let causasEqMock: jest.Mock
  let algoritmosEqMock: jest.Mock
  let bloqueosEqMock: jest.Mock
  let modalidadesEqMock: jest.Mock
  let alfabetosOrderMock: jest.Mock

  beforeEach(() => {
    causasEqMock = jest.fn()
    algoritmosEqMock = jest.fn()
    bloqueosEqMock = jest.fn()
    modalidadesEqMock = jest.fn()
    alfabetosOrderMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq:
            table === 'causas'
              ? causasEqMock
              : table === 'algoritmos'
                ? algoritmosEqMock
                : table === 'bloqueos'
                  ? bloqueosEqMock
                  : table === 'modalidades'
                    ? modalidadesEqMock
                    : () => ({ order: alfabetosOrderMock }),
        }),
      }),
    })
  })

  it('returns an Error when the causas query errors', async () => {
    causasEqMock.mockResolvedValue({
      data: null,
      error: { message: 'causas boom' },
    })
    algoritmosEqMock.mockResolvedValue({ data: [], error: null })
    bloqueosEqMock.mockResolvedValue({ data: [], error: null })
    modalidadesEqMock.mockResolvedValue({ data: [], error: null })
    alfabetosOrderMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: null,
      error: new Error('causas boom'),
    })
  })

  it('returns an Error when the algoritmos query errors', async () => {
    causasEqMock.mockResolvedValue({ data: [], error: null })
    algoritmosEqMock.mockResolvedValue({
      data: null,
      error: { message: 'algos boom' },
    })
    bloqueosEqMock.mockResolvedValue({ data: [], error: null })
    modalidadesEqMock.mockResolvedValue({ data: [], error: null })
    alfabetosOrderMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: null,
      error: new Error('algos boom'),
    })
  })

  it('returns an Error when the bloqueos query errors', async () => {
    causasEqMock.mockResolvedValue({ data: [], error: null })
    algoritmosEqMock.mockResolvedValue({ data: [], error: null })
    bloqueosEqMock.mockResolvedValue({
      data: null,
      error: { message: 'bloq boom' },
    })
    modalidadesEqMock.mockResolvedValue({ data: [], error: null })
    alfabetosOrderMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: null,
      error: new Error('bloq boom'),
    })
  })

  it('returns an Error when the modalidades query errors', async () => {
    causasEqMock.mockResolvedValue({ data: [], error: null })
    algoritmosEqMock.mockResolvedValue({ data: [], error: null })
    bloqueosEqMock.mockResolvedValue({ data: [], error: null })
    modalidadesEqMock.mockResolvedValue({
      data: null,
      error: { message: 'modal boom' },
    })
    alfabetosOrderMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: null,
      error: new Error('modal boom'),
    })
  })

  it('returns an Error when the alfabetos query errors', async () => {
    causasEqMock.mockResolvedValue({ data: [], error: null })
    algoritmosEqMock.mockResolvedValue({ data: [], error: null })
    bloqueosEqMock.mockResolvedValue({ data: [], error: null })
    modalidadesEqMock.mockResolvedValue({ data: [], error: null })
    alfabetosOrderMock.mockResolvedValue({
      data: null,
      error: { message: 'alfa boom' },
    })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: null,
      error: new Error('alfa boom'),
    })
  })

  it('returns the mapped AllDiagnosticos when all five queries succeed', async () => {
    causasEqMock.mockResolvedValue({
      data: [
        {
          id: 'c-1',
          codigo: 'C',
          nombre: 'CN',
          definicion: null,
          emociones_esperadas: null,
          activo: true,
          causa_etapas: [],
        },
      ],
      error: null,
    })
    algoritmosEqMock.mockResolvedValue({
      data: [
        {
          id: 'a-1',
          codigo: 'A',
          nombre: 'AN',
          definicion: null,
          comportamiento: null,
          activo: true,
          algoritmo_etapas: [],
        },
      ],
      error: null,
    })
    bloqueosEqMock.mockResolvedValue({
      data: [
        {
          id: 'b-1',
          codigo: 'B',
          nombre: 'BN',
          descripcion: null,
          activo: true,
        },
      ],
      error: null,
    })
    modalidadesEqMock.mockResolvedValue({
      data: [
        {
          id: 'm-1',
          codigo: 'M01',
          nombre: 'Modal 1',
          cantidad_sesiones: 8,
          cantidad_niveles: 4,
          duracion_meses_estimada: 3,
          activo: true,
          tipos_disco: { nombre: 'Disco Azul' },
        },
      ],
      error: null,
    })
    alfabetosOrderMock.mockResolvedValue({
      data: [
        {
          id: 'alf-1',
          codigo: 'ALF01',
          nombre: 'Alfabeto 1',
          descripcion: null,
          rango_max: 12,
          orden: 3,
          activo: true,
        },
      ],
      error: null,
    })
    expect(await fetchAllDiagnosticos()).toEqual({
      data: {
        causa: [
          {
            id: 'c-1',
            codigo: 'C',
            nombre: 'CN',
            definicion: '',
            emocionesEsperadas: [],
            activo: true,
            etapas: [],
          },
        ],
        algoritmo: [
          {
            id: 'a-1',
            codigo: 'A',
            nombre: 'AN',
            definicion: '',
            comportamiento: '',
            comportamientoBadge: '',
            activo: true,
            etapas: [],
          },
        ],
        bloqueos: [
          {
            id: 'b-1',
            codigo: 'B',
            nombre: 'BN',
            descripcion: '',
            activo: true,
          },
        ],
        modalidades: [
          {
            id: 'm-1',
            codigo: 'M01',
            nombre: 'Modal 1',
            tipoDiscoNombre: 'Disco Azul',
            cantidadSesiones: 8,
            cantidadNiveles: 4,
            duracionMesesEstimada: 3,
            descripcionCorta: '8 discos · 4 niveles',
            activo: true,
          },
        ],
        alfabetos: [
          {
            id: 'alf-1',
            codigo: 'ALF01',
            nombre: 'Alfabeto 1',
            descripcion: null,
            rangoMax: 12,
            orden: 3,
            activo: true,
          },
        ],
      },
      error: null,
    })
  })
})
