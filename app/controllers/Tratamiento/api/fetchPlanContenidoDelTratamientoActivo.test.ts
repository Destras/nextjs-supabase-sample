import { createClient } from '@/lib/supabase/client'
import { mapEtapaToTratamientoConEntregas } from '../utils/mapEtapaToTratamientoConEntregas'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import type { Tratamiento } from '../TratamientoTypes'
import { fetchPlanContenidoDelTratamientoActivo } from './fetchPlanContenidoDelTratamientoActivo'

jest.mock('@/lib/supabase/client')
jest.mock('../utils/mapEtapaToTratamientoConEntregas')

describe('fetchPlanContenidoDelTratamientoActivo', () => {
  let maybeSingleMock: jest.Mock
  let rpcMock: jest.Mock
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
      niveles: [],
      entregasSemanales: [
        {
          id: 'semana-1',
          numeroSemana: 1,
          fechaEntregada: null,
          fechaEntregaEsperada: null,
          contenido: [],
        },
      ],
    }

    maybeSingleMock = jest.fn()
    rpcMock = jest.fn()
    isMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }))
    eqMock = jest.fn(() => ({ is: isMock }))
    ;(createClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: eqMock,
        }),
      }),
      rpc: rpcMock,
    })
    ;(mapEtapaToTratamientoConEntregas as jest.Mock).mockReturnValue({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
    })
  })

  it('returns the mapped tratamiento and semanasTotales when supabase returns a row', async () => {
    const rawRow = { id: 'etapa-1' }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    rpcMock.mockResolvedValue({ data: [], error: null })

    expect(await fetchPlanContenidoDelTratamientoActivo('p-1')).toEqual({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })
  })

  it('returns null tratamiento and null semanasTotales without error when there is no active etapa', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    rpcMock.mockResolvedValue({ data: [], error: null })

    expect(await fetchPlanContenidoDelTratamientoActivo('p-1')).toEqual({
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
      error: null,
    })
  })

  it('returns null tratamiento and null semanasTotales with error message when supabase errors', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    rpcMock.mockResolvedValue({ data: [], error: null })

    expect(await fetchPlanContenidoDelTratamientoActivo('p-1')).toEqual({
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
      error: 'boom',
    })
  })

  // ---------------------------------------------------------------------
  // Resolución de la etapa abierta (INI-001, inicioTratamiento)
  // ---------------------------------------------------------------------

  it('resolves the open etapa by fecha_finalizacion is null, not by estado codigo (INI-001 causa A)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    await fetchPlanContenidoDelTratamientoActivo('p-1')

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
    rpcMock.mockResolvedValue({ data: [], error: null })
    ;(mapEtapaToTratamientoConEntregas as jest.Mock).mockReturnValue({
      tratamiento: { ...tratamientoFixture, fechaInicio: null },
      semanasTotales: 16,
      cantidadNiveles: 4,
      frasesPorSemana: {},
    })

    expect(await fetchPlanContenidoDelTratamientoActivo('p-1')).toEqual({
      tratamiento: { ...tratamientoFixture, fechaInicio: null },
      semanasTotales: 16,
      cantidadNiveles: 4,
      frasesPorSemana: {},
      error: null,
    })
  })

  // ---------------------------------------------------------------------
  // get_frases_del_tratamiento_activo RPC (Task 0.4)
  // ---------------------------------------------------------------------

  it('calls the RPC in parallel with p_paciente_id and forwards its rows to the mapper as the second argument', async () => {
    const rawRow = { id: 'etapa-1' }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    const frasesRows = [
      { semana: 1, frases: [{ orden: 1, origen: 'causa', texto: 'F1' }] },
    ]
    rpcMock.mockResolvedValue({ data: frasesRows, error: null })

    await fetchPlanContenidoDelTratamientoActivo('p-1')

    expect(rpcMock).toHaveBeenCalledWith('get_frases_del_tratamiento_activo', {
      p_paciente_id: 'p-1',
    })
    expect(mapEtapaToTratamientoConEntregas).toHaveBeenCalledWith(
      rawRow,
      frasesRows,
    )
  })

  it('degrades to frasesPorSemana [] (and still resolves the plan) when the RPC errors', async () => {
    const rawRow = { id: 'etapa-1' }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    rpcMock.mockResolvedValue({ data: null, error: { message: 'rpc boom' } })

    const result = await fetchPlanContenidoDelTratamientoActivo('p-1')

    expect(mapEtapaToTratamientoConEntregas).toHaveBeenCalledWith(rawRow, [])
    expect(result).toEqual({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })
  })

  it('degrades to frasesPorSemana [] when the RPC resolves with null data', async () => {
    const rawRow = { id: 'etapa-1' }
    maybeSingleMock.mockResolvedValue({ data: rawRow, error: null })
    rpcMock.mockResolvedValue({ data: null, error: null })

    await fetchPlanContenidoDelTratamientoActivo('p-1')

    expect(mapEtapaToTratamientoConEntregas).toHaveBeenCalledWith(rawRow, [])
  })
})
