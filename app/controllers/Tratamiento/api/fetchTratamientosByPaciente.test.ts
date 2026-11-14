import { createClient } from '@/lib/supabase/client'
import { fetchTratamientosByPaciente } from './fetchTratamientosByPaciente'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'

jest.mock('@/lib/supabase/client')

describe('fetchTratamientosByPaciente', () => {
  let eqMock: jest.Mock

  beforeEach(() => {
    eqMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: eqMock,
        }),
      }),
    })
  })

  it('returns an Error when supabase returns an error', async () => {
    eqMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchTratamientosByPaciente('p-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns an empty array when there are no etapas', async () => {
    eqMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchTratamientosByPaciente('p-1')).toEqual({
      data: [],
      error: null,
    })
  })

  it('skips etapas whose causas or algoritmos join is null', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          id: 'etapa-1',
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estados_etapa: { codigo: 'activo' },
          causas: null,
          algoritmos: {
            id: 'algo-1',
            codigo: 'A01',
            nombre: 'A',
            definicion: 'd',
            comportamiento: 'b',
            activo: true,
          },
          etapa_bloqueos: [],
        },
      ],
      error: null,
    })
    expect(await fetchTratamientosByPaciente('p-1')).toEqual({
      data: [],
      error: null,
    })
  })

  it('returns the mapped tratamientos when supabase succeeds', async () => {
    eqMock.mockResolvedValue({
      data: [
        {
          id: 'etapa-1',
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estados_etapa: { codigo: 'activo' },
          causas: {
            id: 'c-1',
            codigo: 'C',
            nombre: 'N',
            definicion: 'd',
            emociones_esperadas: 'e',
            activo: true,
          },
          algoritmos: {
            id: 'a-1',
            codigo: 'A',
            nombre: 'AN',
            definicion: 'd',
            comportamiento: 'b',
            activo: true,
          },
          etapa_bloqueos: [],
        },
      ],
      error: null,
    })
    expect(await fetchTratamientosByPaciente('p-1')).toEqual({
      data: [
        {
          id: 'etapa-1',
          fechaInicio: '2025-01-01',
          fechaFin: null,
          estado: TRATAMIENTO_STATE.ACTIVO,
          diagnostico: {
            causa: {
              id: 'c-1',
              codigo: 'C',
              nombre: 'N',
              definicion: 'd',
              emocionesEsperadas: ['e'],
              activo: true,
              etapas: [],
            },
            algoritmo: {
              id: 'a-1',
              codigo: 'A',
              nombre: 'AN',
              definicion: 'd',
              comportamiento: 'b',
              comportamientoBadge: 'b',
              activo: true,
              etapas: [],
            },
            bloqueos: [],
          },
          niveles: [],
          entregasSemanales: [],
        },
      ],
      error: null,
    })
  })
})
