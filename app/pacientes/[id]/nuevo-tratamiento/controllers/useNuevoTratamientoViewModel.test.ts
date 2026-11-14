import { act, renderHook, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import {
  useFetchPacienteById,
  useIniciarNuevaEtapa,
} from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { useNuevoTratamientoViewModel } from './useNuevoTratamientoViewModel'

import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/components/navigation', () => ({
  useNavigationGuard: jest.fn(),
  useUnsavedChangesGuard: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/app/controllers/Diagnostico', () => ({
  useFetchAllDiagnosticos: jest.fn(),
}))

jest.mock('@/app/controllers/Paciente', () => {
  const actual = jest.requireActual('@/app/controllers/Paciente')
  return {
    ...actual,
    useFetchPacienteById: jest.fn(),
    useIniciarNuevaEtapa: jest.fn(),
  }
})

const mockPush = jest.fn()

const mockAllDiagnosticos = {
  causa: [
    {
      id: 'c-1',
      codigo: 'C1',
      nombre: 'Causa 1',
      definicion: '',
      emocionesEsperadas: '',
      activo: true,
      etapas: [],
    },
  ],
  bloqueos: [
    {
      id: 'b-1',
      codigo: 'B1',
      nombre: 'Bloqueo 1',
      descripcion: '',
      activo: true,
    },
  ],
  algoritmo: [
    {
      id: 'a-1',
      codigo: 'A1',
      nombre: 'Algoritmo 1',
      definicion: '',
      comportamiento: '',
      activo: true,
      etapas: [],
    },
  ],
  modalidades: [
    {
      id: 'm-1',
      codigo: 'M1',
      nombre: 'Modalidad 1',
      tipoDiscoNombre: null,
      cantidadSesiones: null,
      cantidadNiveles: 4,
      duracionMesesEstimada: null,
      activo: true,
    },
  ],
  alfabetos: [
    {
      id: 'af-1',
      codigo: 'AF1',
      nombre: 'Alfabeto 1',
      descripcion: null,
      rangoMax: 40,
      orden: 1,
      activo: true,
    },
  ],
}

const buildPaciente = (overrides: Partial<Paciente> = {}): Paciente => ({
  id: 'pac-1',
  nombre: 'Ana García',
  nivelFinalizado: false,
  mesActual: null,
  mesesTotales: null,
  etapaOrdinal: 1,
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
    telefono: '+5491155550070',
    email: 'ana@example.com',
    fechaNacimiento: '1990-06-15',
    edad: 34,
    fechaAlta: '2024-01-01',
  },
  state: 'activo' as Paciente['state'],
  ...overrides,
})

describe('useNuevoTratamientoViewModel', () => {
  let mockSubmit: jest.Mock
  let mockRefetch: jest.Mock

  beforeEach(() => {
    mockSubmit = jest.fn().mockResolvedValue({ etapaId: null, error: null })
    mockRefetch = jest.fn()
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: (proceed: () => void) => proceed(),
      hasUnsavedChanges: () => false,
    })
    ;(useParams as jest.Mock).mockReturnValue({ id: 'pac-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: mockAllDiagnosticos,
      isLoading: false,
      error: null,
    })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: buildPaciente(),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    })
    ;(useIniciarNuevaEtapa as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
  })

  it('starts at paso 1', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.formState.paso).toBe(1)
  })

  it('starts with diagnostico fields null/empty', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.formState.diagnostico).toEqual({
      causaId: null,
      bloqueoIds: [],
      algoritmoId: null,
    })
  })

  it('starts with plan fields null/empty', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.formState.plan).toEqual({
      modalidadId: null,
      alfabetos: [],
    })
  })

  it('starts with errores empty', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.errores).toEqual({})
  })

  it('starts with submitError null', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.submitError).toBeNull()
  })

  // isLoading
  it('isLoading is true while catalogos are loading', () => {
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading is true while paciente is loading', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading is false when both catalogos and paciente finished loading', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.isLoading).toBe(false)
  })

  // loadError
  it('loadError surfaces the catalogos error', () => {
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: false,
      error: 'catalogos error',
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.loadError).toBe('catalogos error')
  })

  it('loadError surfaces the paciente error when catalogos has none', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: 'paciente error',
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.loadError).toBe('paciente error')
  })

  it('loadError is null when neither fetch has an error', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.loadError).toBeNull()
  })

  // notFound
  it('notFound is true when not loading, no error, and paciente is null', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.notFound).toBe(true)
  })

  it('notFound is false while still loading', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.notFound).toBe(false)
  })

  it('notFound is false when paciente is present', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.notFound).toBe(false)
  })

  // tieneEtapaActiva
  it('tieneEtapaActiva is true when the paciente has an open etapa', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: buildPaciente({
        fechaInicioEtapaActiva: '2024-05-01',
        etapaActivaId: 'e-1',
      }),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.tieneEtapaActiva).toBe(true)
  })

  it('tieneEtapaActiva is false when the paciente has no open etapa', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.tieneEtapaActiva).toBe(false)
  })

  it('tieneEtapaActiva is false when paciente is null', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.tieneEtapaActiva).toBe(false)
  })

  // detailHref
  it('detailHref points to the camino tab of the paciente detail', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.detailHref).toBe('/pacientes/pac-1/camino')
  })

  // catalogos
  it('exposes catalogos from useFetchAllDiagnosticos', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.catalogos).toEqual(mockAllDiagnosticos)
  })

  // setCausa / toggleBloqueo / setAlgoritmo
  it('setCausa sets diagnostico.causaId', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
    })
    expect(result.current.formState.diagnostico.causaId).toBe('c-1')
  })

  it('toggleBloqueo adds a bloqueo id', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    expect(result.current.formState.diagnostico.bloqueoIds).toEqual(['b-1'])
  })

  it('toggleBloqueo removes an already-present bloqueo id', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    expect(result.current.formState.diagnostico.bloqueoIds).toEqual([])
  })

  it('setAlgoritmo sets diagnostico.algoritmoId', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setAlgoritmo('a-1')
    })
    expect(result.current.formState.diagnostico.algoritmoId).toBe('a-1')
  })

  // setModalidad / setAlfabetos
  it('setModalidad sets plan.modalidadId', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setModalidad('m-1')
    })
    expect(result.current.formState.plan.modalidadId).toBe('m-1')
  })

  it('setAlfabetos replaces the alfabetos with their numbers', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2, 5] }])
    })
    expect(result.current.formState.plan.alfabetos).toEqual([
      { alfabetoId: 'af-1', numeros: [2, 5] },
    ])
  })

  it('setAlfabetos with an empty list clears the alfabetos', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2] }])
    })
    act(() => {
      result.current.setAlfabetos([])
    })
    expect(result.current.formState.plan.alfabetos).toEqual([])
  })

  // puedeAvanzar
  it('puedeAvanzar is false on paso 1 when causaId is null', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.puedeAvanzar).toBe(false)
  })

  it('puedeAvanzar is true on paso 1 when causa and algoritmo are set', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
    })
    expect(result.current.puedeAvanzar).toBe(true)
  })

  it('puedeAvanzar is true on paso 2 when modalidad is set', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    act(() => {
      result.current.setModalidad('m-1')
    })
    expect(result.current.puedeAvanzar).toBe(true)
  })

  it('puedeAvanzar is false on paso 2 when modalidad is null', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    expect(result.current.puedeAvanzar).toBe(false)
  })

  // goNext
  it('goNext with invalid paso 1 does not advance', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.goNext()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('goNext with invalid paso 1 publishes causa error', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.goNext()
    })
    expect(result.current.errores['diagnostico.causaId']).toBe(
      'Seleccioná una causa raíz',
    )
  })

  it('goNext with valid paso 1 advances to paso 2', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    expect(result.current.formState.paso).toBe(2)
  })

  it('goNext with valid paso 1 clears errores', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.goNext()
    })
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    expect(result.current.errores).toEqual({})
  })

  // goBack
  it('goBack from paso 2 returns to paso 1', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    act(() => {
      result.current.goBack()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('goBack from paso 1 stays at paso 1', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.goBack()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  // jumpToStep
  it('jumpToStep(1) from paso 2 returns to paso 1', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    act(() => {
      result.current.jumpToStep(1)
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('jumpToStep(2) from paso 1 is a no-op', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.jumpToStep(2)
    })
    expect(result.current.formState.paso).toBe(1)
  })

  // pasos
  it('pasos marks paso 1 as active and paso 2 as upcoming on paso 1', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.pasos.map((p) => p.status)).toEqual([
      'active',
      'upcoming',
    ])
  })

  it('pasos marks paso 1 as done and paso 2 as active on paso 2', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.goNext()
    })
    expect(result.current.pasos.map((p) => p.status)).toEqual([
      'done',
      'active',
    ])
  })

  it('pasos has exactly 2 entries titled Diagnóstico and Plan', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.pasos.map((p) => p.title)).toEqual([
      'Diagnóstico',
      'Plan',
    ])
  })

  // confirmationSummary
  it('confirmationSummary reflects the fetched paciente and selected catalogo entries', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.toggleBloqueo('b-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [15, 21] }])
    })
    expect(result.current.confirmationSummary).toEqual({
      nombreDisplay: 'Ana García',
      edadDisplay: '34',
      emailDisplay: 'ana@example.com',
      causaNombre: 'Causa 1',
      algoritmoNombre: 'Algoritmo 1',
      modalidadNombre: 'Modalidad 1',
      bloqueoCount: 1,
      alfabetosDisplay: 'Alfabeto 1 15, 21',
    })
  })

  it('confirmationSummary falls back to placeholders when nothing is selected yet', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.confirmationSummary).toEqual({
      nombreDisplay: 'Ana García',
      edadDisplay: '34',
      emailDisplay: 'ana@example.com',
      causaNombre: '—',
      algoritmoNombre: '—',
      modalidadNombre: '—',
      bloqueoCount: 0,
      alfabetosDisplay: 'Sin alfabetos',
    })
  })

  it('confirmationSummary falls back to placeholders when paciente is null', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.confirmationSummary).toEqual({
      nombreDisplay: '—',
      edadDisplay: '—',
      emailDisplay: '',
      causaNombre: '—',
      algoritmoNombre: '—',
      modalidadNombre: '—',
      bloqueoCount: 0,
      alfabetosDisplay: 'Sin alfabetos',
    })
  })

  // submit
  it('submit with validation errors does not call useIniciarNuevaEtapa submit', async () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('submit with all steps valid calls useIniciarNuevaEtapa submit with correct payload', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: 'e-1', error: null })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.toggleBloqueo('b-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2] }])
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).toHaveBeenCalledWith({
      pacienteId: 'pac-1',
      causaId: 'c-1',
      algoritmoId: 'a-1',
      modalidadId: 'm-1',
      bloqueoIds: ['b-1'],
      alfabetos: [{ alfabetoId: 'af-1', numeros: [2] }],
    })
  })

  it('submit success shows the success toast', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: 'e-1', error: null })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(toast.success).toHaveBeenCalledWith('Tratamiento iniciado')
  })

  it('submit success redirects to asignar-contenido with the paciente preselected', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: 'e-1', error: null })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockPush).toHaveBeenCalledWith('/asignar-contenido?paciente=pac-1')
  })

  it('submit with RPC error sets submitError and shows the error toast', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: null, error: 'RPC failed' })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('RPC failed')
  })

  it('submit translates numeros_invalidos into the Spanish copy', async () => {
    mockSubmit.mockResolvedValueOnce({
      etapaId: null,
      error: 'numeros_invalidos',
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe(
      'Revisá los números de los alfabetos.',
    )
  })

  it('submit shows a code that is not about alfabetos as it comes', async () => {
    mockSubmit.mockResolvedValueOnce({
      etapaId: null,
      error: 'telefono_invalido',
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('telefono_invalido')
  })

  it('submit with RPC error does not redirect', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: null, error: 'RPC failed' })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('submit with a thrown exception captures the message in submitError', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('network unreachable'))
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('network unreachable')
  })

  it('submit with a non-Error thrown value falls back to a generic message', async () => {
    mockSubmit.mockRejectedValueOnce('boom')
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    await waitFor(() => {
      expect(result.current.submitError).toBe(
        'No se pudo iniciar el tratamiento',
      )
    })
  })

  it('submit is a no-op while a submission is already in flight', async () => {
    ;(useIniciarNuevaEtapa as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: true,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  // isSubmitting
  it('isSubmitting reflects the mutation hook state', () => {
    ;(useIniciarNuevaEtapa as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: true,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    expect(result.current.isSubmitting).toBe(true)
  })

  // cancel
  it('cancel navigates to the detail camino tab', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.cancel()
    })
    expect(mockPush).toHaveBeenCalledWith('/pacientes/pac-1/camino')
  })

  // dismissSubmitError
  it('dismissSubmitError clears submitError', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: null, error: 'algo falló' })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    act(() => {
      result.current.dismissSubmitError()
    })
    expect(result.current.submitError).toBeNull()
  })

  // guard de cambios sin guardar (BETA-047)
  it('no declara cambios sin guardar al abrir', () => {
    renderHook(() => useNuevoTratamientoViewModel())
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('declara cambios sin guardar al elegir algo', () => {
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
    })
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('deja de declarar cambios sin guardar cuando el tratamiento se inició', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: 'e-1', error: null })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('sigue declarando cambios sin guardar si iniciar el tratamiento falla', async () => {
    mockSubmit.mockResolvedValueOnce({ etapaId: null, error: 'algo falló' })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('cancel pasa por el guard y no navega si el usuario no confirma', () => {
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: jest.fn(),
      hasUnsavedChanges: () => true,
    })
    const { result } = renderHook(() => useNuevoTratamientoViewModel())
    act(() => {
      result.current.cancel()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
