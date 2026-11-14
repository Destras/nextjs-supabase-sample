import { act, renderHook, waitFor } from '@testing-library/react'
import type { Paciente } from '../PacienteTypes'
import { PACIENTE_STATE } from '../PacienteTypes'
import { fetchPacientesByTerapeuta } from './fetchPacientesByTerapeuta'
import { useFetchPacientesByTerapeuta } from './useFetchPacientesByTerapeuta'

jest.mock('./fetchPacientesByTerapeuta')

describe('useFetchPacientesByTerapeuta', () => {
  let pacienteFixture: Paciente

  beforeEach(() => {
    pacienteFixture = {
      id: 'p-1',
      nombre: 'Juan',
      nivelFinalizado: false,
      mesActual: null,
      mesesTotales: null,
      etapaOrdinal: null,
      evaluaciones: [],
      semanaGlobal: null,
      semanasTotales: null,
      fechaInicioEtapaActiva: null,
      etapaActivaId: null,
      sinIniciar: false,
      modalidadResumen: null,
      causaActual: null,
      bloqueosIdentificados: [],
      algoritmoActual: null,
      alfabetosActuales: [],
      ultimoScore: null,
      tendencia: 'flat',
      tieneAlerta: false,
      ultimaEvaluacion: null,
      proximaEvaluacion: null,
      inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
      tieneCuenta: false,
      bienvenidaRecibida: false,
      generalInfo: {
        telefono: null,
        email: null,
        fechaNacimiento: null,
        edad: null,
        fechaAlta: null,
      },
      state: PACIENTE_STATE.ACTIVE,
    }
  })

  it('stays idle with empty pacientes when terapeutaId is null', async () => {
    const { result } = renderHook(() => useFetchPacientesByTerapeuta(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        pacientes: [],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchPacientesByTerapeuta('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        pacientes: [],
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('returns the fetched pacientes when the fetch succeeds', async () => {
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: [pacienteFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchPacientesByTerapeuta('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        pacientes: [pacienteFixture],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('refresh trae de nuevo la lista (BETA-046)', async () => {
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: [pacienteFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchPacientesByTerapeuta('t-1'))
    await act(async () => {})
    const actualizado = { ...pacienteFixture, mesActual: 1, semanaGlobal: 1 }
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: [actualizado],
      error: null,
    })
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.pacientes).toEqual([actualizado])
  })

  it('refresh no vuelve a mostrar la carga inicial', async () => {
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: [pacienteFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchPacientesByTerapeuta('t-1'))
    await act(async () => {})
    let resolver: (value: unknown) => void = () => {}
    ;(fetchPacientesByTerapeuta as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      }),
    )
    let pendiente: Promise<void> = Promise.resolve()
    act(() => {
      pendiente = result.current.refresh()
    })
    const cargandoDuranteElRefresh = result.current.isLoading
    await act(async () => {
      resolver({ data: [pacienteFixture], error: null })
      await pendiente
    })
    expect(cargandoDuranteElRefresh).toBe(false)
  })

  it('refresh conserva la lista si el pedido falla', async () => {
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: [pacienteFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchPacientesByTerapeuta('t-1'))
    await act(async () => {})
    ;(fetchPacientesByTerapeuta as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.pacientes).toEqual([pacienteFixture])
  })

  it('refresh no pide nada sin terapeuta', async () => {
    const { result } = renderHook(() => useFetchPacientesByTerapeuta(null))
    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchPacientesByTerapeuta).not.toHaveBeenCalled()
  })
})
