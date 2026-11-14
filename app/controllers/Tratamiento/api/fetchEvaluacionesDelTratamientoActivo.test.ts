import { createClient } from '@/lib/supabase/client'
import { mapEtapaToTratamientoConNiveles } from '../utils/mapEtapaToTratamientoConNiveles'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import type { Tratamiento } from '../TratamientoTypes'
import { fetchEvaluacionesDelTratamientoActivo } from './fetchEvaluacionesDelTratamientoActivo'

jest.mock('@/lib/supabase/client')
jest.mock('../utils/mapEtapaToTratamientoConNiveles')

describe('fetchEvaluacionesDelTratamientoActivo', () => {
  let maybeSingleMock: jest.Mock
  let eqMock: jest.Mock
  let isMock: jest.Mock
  let tratamientoFixture: Tratamiento

  beforeEach(() => {
    tratamientoFixture = {
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: null,
      estado: TRATAMIENTO_STATE.ACTIVO,
      diagnostico: {
        causa: {
          id: 'c-1',
          codigo: 'C',
          nombre: 'N',
          definicion: '',
          emocionesEsperadas: [],
          activo: true,
          etapas: [],
        },
        algoritmo: {
          id: 'a-1',
          codigo: 'A',
          nombre: 'AN',
          definicion: '',
          comportamiento: '',
          comportamientoBadge: '',
          activo: true,
          etapas: [],
        },
        bloqueos: [],
      },
      niveles: [
        {
          id: 'n-1',
          numeroNivel: 1,
          fechaSeguimientoEsperado: '2025-02-01',
          fechaSeguimientoReal: null,
          observaciones: null,
          evaluacion: { id: 'ev-1', score: 4, fechaRespuesta: '2025-02-01' },
        },
      ],
      entregasSemanales: [],
    }

    maybeSingleMock = jest.fn()
    isMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
    eqMock = jest.fn(() => ({ is: isMock }))
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: eqMock,
        }),
      }),
    })
  })

  it('returns the mapped tratamiento when supabase returns a row', async () => {
    const rawRow = { id: 'etapa-1' }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    ;(mapEtapaToTratamientoConNiveles as jest.Mock).mockReturnValue(
      tratamientoFixture,
    )

    expect(await fetchEvaluacionesDelTratamientoActivo('p-1')).toEqual({
      tratamiento: tratamientoFixture,
      error: null,
    })
  })

  it('returns null tratamiento without error when there is no active etapa', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    expect(await fetchEvaluacionesDelTratamientoActivo('p-1')).toEqual({
      tratamiento: null,
      error: null,
    })
  })

  it('returns null tratamiento with error message when supabase errors', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })

    expect(await fetchEvaluacionesDelTratamientoActivo('p-1')).toEqual({
      tratamiento: null,
      error: 'boom',
    })
  })

  it('resolves the open etapa by fecha_finalizacion is null, not by estado codigo (INI-002)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    await fetchEvaluacionesDelTratamientoActivo('p-1')

    expect(eqMock).toHaveBeenCalledWith('paciente_id', 'p-1')
    expect(eqMock).not.toHaveBeenCalledWith('estados_etapa.codigo', 'activa')
    expect(isMock).toHaveBeenCalledWith('fecha_finalizacion', null)
  })

  it('maps a pendiente etapa (fecha_inicio null, fecha_finalizacion null) as the open one', async () => {
    const rawRow = {
      id: 'etapa-1',
      fecha_inicio: null,
      fecha_finalizacion: null,
    }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    const pendienteTratamiento = { ...tratamientoFixture, fechaInicio: null }
    ;(mapEtapaToTratamientoConNiveles as jest.Mock).mockReturnValue(
      pendienteTratamiento,
    )

    expect(await fetchEvaluacionesDelTratamientoActivo('p-1')).toEqual({
      tratamiento: pendienteTratamiento,
      error: null,
    })
  })
})
