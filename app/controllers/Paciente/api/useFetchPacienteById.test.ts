import { renderHook, waitFor, act } from '@testing-library/react'
import type { Paciente } from '../PacienteTypes'
import { PACIENTE_STATE } from '../PacienteTypes'
import { fetchPacienteById } from './fetchPacienteById'
import { useFetchPacienteById } from './useFetchPacienteById'

jest.mock('./fetchPacienteById')

describe('useFetchPacienteById', () => {
  let pacienteFixture: Paciente

  beforeEach(() => {
    pacienteFixture = {
      id: 'asig-1',
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

  it('stays idle with null paciente when pacienteId is null', async () => {
    const { result } = renderHook(() => useFetchPacienteById(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        paciente: null,
        isLoading: false,
        error: null,
        refetch: expect.any(Function),
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchPacienteById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() =>
      useFetchPacienteById('00000000-0000-0000-0000-000000000001'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        paciente: null,
        isLoading: false,
        error: 'boom',
        refetch: expect.any(Function),
      })
    })
  })

  it('returns the fetched paciente when the fetch succeeds', async () => {
    ;(fetchPacienteById as jest.Mock).mockResolvedValue({
      data: pacienteFixture,
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchPacienteById('00000000-0000-0000-0000-000000000001'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        paciente: pacienteFixture,
        isLoading: false,
        error: null,
        refetch: expect.any(Function),
      })
    })
  })

  it('calls fetchPacienteById a second time when refetch is invoked', async () => {
    ;(fetchPacienteById as jest.Mock).mockResolvedValue({
      data: pacienteFixture,
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchPacienteById('00000000-0000-0000-0000-000000000001'),
    )
    await waitFor(() => {
      expect(fetchPacienteById).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(fetchPacienteById).toHaveBeenCalledTimes(2)
    })
  })
})
