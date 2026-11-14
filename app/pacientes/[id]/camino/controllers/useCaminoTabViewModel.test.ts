import { renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { useFetchPacienteById } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { useCaminoTabViewModel } from './useCaminoTabViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacienteById: jest.fn(),
}))

const buildPaciente = (overrides: Partial<Paciente> = {}): Paciente => ({
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
  ...overrides,
})

const baseResult = {
  paciente: null,
  isLoading: false,
  error: null,
}

describe('useCaminoTabViewModel', () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-1' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
    })
  })

  it('forwards the error string when the fetch fails', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: 'boom',
    })
    const { result } = renderHook(() => useCaminoTabViewModel())
    expect(result.current).toEqual({ ...baseResult, error: 'boom' })
  })

  it('returns paciente null with no error when fetch resolves empty', () => {
    const { result } = renderHook(() => useCaminoTabViewModel())
    expect(result.current).toEqual(baseResult)
  })

  it('returns isLoading true when the fetch is still loading', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useCaminoTabViewModel())
    expect(result.current).toEqual({ ...baseResult, isLoading: true })
  })

  it('passes the pacienteId from useParams to the fetcher', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-42' })
    renderHook(() => useCaminoTabViewModel())
    expect(useFetchPacienteById).toHaveBeenCalledWith('p-42')
  })

  it('returns the paciente when the fetch succeeds', () => {
    const paciente = buildPaciente({ nombre: 'Valentina' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useCaminoTabViewModel())
    expect(result.current).toEqual({ ...baseResult, paciente })
  })
})
