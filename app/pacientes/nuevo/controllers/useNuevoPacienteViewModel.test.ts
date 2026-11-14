import { act, renderHook, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ROLE, useCurrentUserProfile } from '@/app/controllers/Auth'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import {
  useBuscarFichaPorEmail,
  useCheckTelefonoEnOtraFicha,
  useRegisterPaciente,
} from '@/app/controllers/Paciente'
import { AVISO_TELEFONO_DUPLICADO } from '@/lib/identidadMessages'
import { useNuevoPacienteViewModel } from './useNuevoPacienteViewModel'

import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'

jest.mock('next/navigation', () => ({
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

jest.mock('@/app/controllers/Auth', () => ({
  ...jest.requireActual('@/app/controllers/Auth'),
  useCurrentUserProfile: jest.fn(),
}))

jest.mock('@/app/controllers/Paciente', () => ({
  useRegisterPaciente: jest.fn(),
  useCheckTelefonoEnOtraFicha: jest.fn(),
  useBuscarFichaPorEmail: jest.fn(),
}))

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

describe('useNuevoPacienteViewModel', () => {
  let mockSubmit: jest.Mock
  let mockCheck: jest.Mock
  let mockBuscar: jest.Mock

  // Completa los 3 pasos con datos válidos y envía; `email` lleva espacios para
  // comprobar que la búsqueda de la ficha usa el mismo valor recortado que el alta.
  const submitValidForm = async (
    result: { current: ReturnType<typeof useNuevoPacienteViewModel> },
    email = 'sofia@example.com',
  ) => {
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', email)
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
  }

  beforeEach(() => {
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: (proceed: () => void) => proceed(),
      hasUnsavedChanges: () => false,
    })
    mockBuscar = jest.fn().mockResolvedValue({ ficha: null, error: null })
    ;(useBuscarFichaPorEmail as jest.Mock).mockReturnValue({
      buscar: mockBuscar,
    })
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: { role: ROLE.TERAPEUTA },
      isLoading: false,
      error: null,
    })
    mockSubmit = jest.fn().mockResolvedValue({ pacienteId: null, error: null })
    mockCheck = jest.fn().mockResolvedValue({ enOtraFicha: false, error: null })
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: mockAllDiagnosticos,
      isLoading: false,
      error: null,
    })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
      error: null,
      pacienteId: null,
    })
    ;(useCheckTelefonoEnOtraFicha as jest.Mock).mockReturnValue({
      check: mockCheck,
    })
  })

  it('starts at paso 1 with all fields empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.formState.paso).toBe(1)
  })

  it('starts with identidad fields empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.formState.identidad).toEqual({
      nombre: '',
      fechaNacimiento: null,
      email: '',
      telefono: '',
    })
  })

  it('starts with diagnostico fields null/empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.formState.diagnostico).toEqual({
      causaId: null,
      bloqueoIds: [],
      algoritmoId: null,
    })
  })

  it('starts with plan fields null/empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.formState.plan).toEqual({
      modalidadId: null,
      alfabetos: [],
    })
  })

  it('starts with errores empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.errores).toEqual({})
  })

  it('starts with puedeAvanzar false (paso 1, nombre empty)', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.puedeAvanzar).toBe(false)
  })

  it('exposes catalogos from useFetchAllDiagnosticos', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.catalogos).toEqual(mockAllDiagnosticos)
  })

  it('exposes isLoadingCatalogos from the fetch hook', () => {
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.isLoadingCatalogos).toBe(true)
  })

  it('exposes catalogosError from the fetch hook', () => {
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: false,
      error: 'network error',
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.catalogosError).toBe('network error')
  })

  // setIdentidadField
  it('setIdentidadField updates nombre', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana')
    })
    expect(result.current.formState.identidad.nombre).toBe('Ana')
  })

  it('setIdentidadField updates email', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('email', 'ana@test.com')
    })
    expect(result.current.formState.identidad.email).toBe('ana@test.com')
  })

  it('setIdentidadField updates fechaNacimiento', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
    })
    expect(result.current.formState.identidad.fechaNacimiento).toBe(
      '1990-06-15',
    )
  })

  // validateNombre via onBlurField
  it('onBlurField on empty nombre publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    expect(result.current.errores['identidad.nombre']).toBe(
      'El nombre es requerido',
    )
  })

  it('onBlurField on nombre with 1 char publishes min-length error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'A')
    })
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    expect(result.current.errores['identidad.nombre']).toBe(
      'Mínimo 2 caracteres',
    )
  })

  it('onBlurField on nombre with 121 chars publishes max-length error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'A'.repeat(121))
    })
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    expect(result.current.errores['identidad.nombre']).toBe(
      'Máximo 120 caracteres',
    )
  })

  it('onBlurField on valid nombre clears the error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
    })
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    expect(result.current.errores['identidad.nombre']).toBeUndefined()
  })

  // validateFechaNacimiento via onBlurField
  it('onBlurField on null fechaNacimiento publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.fechaNacimiento')
    })
    expect(result.current.errores['identidad.fechaNacimiento']).toBe(
      'La fecha de nacimiento es requerida',
    )
  })

  it('onBlurField on fechaNacimiento with year < 1900 publishes min-year error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('fechaNacimiento', '1899-12-31')
    })
    act(() => {
      result.current.onBlurField('identidad.fechaNacimiento')
    })
    expect(result.current.errores['identidad.fechaNacimiento']).toBe(
      'Año mínimo 1900',
    )
  })

  it('onBlurField on fechaNacimiento in the future publishes future-date error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('fechaNacimiento', '2099-01-01')
    })
    act(() => {
      result.current.onBlurField('identidad.fechaNacimiento')
    })
    expect(result.current.errores['identidad.fechaNacimiento']).toBe(
      'No puede ser posterior a hoy',
    )
  })

  it('onBlurField on invalid fechaNacimiento string publishes invalid error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('fechaNacimiento', 'not-a-date')
    })
    act(() => {
      result.current.onBlurField('identidad.fechaNacimiento')
    })
    expect(result.current.errores['identidad.fechaNacimiento']).toBe(
      'Fecha inválida',
    )
  })

  // validateEmail via onBlurField
  it('onBlurField on empty email publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.email')
    })
    expect(result.current.errores['identidad.email']).toBe(
      'El email es requerido',
    )
  })

  it('onBlurField on invalid email publishes email error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('email', 'notanemail')
    })
    act(() => {
      result.current.onBlurField('identidad.email')
    })
    expect(result.current.errores['identidad.email']).toBe('Email inválido')
  })

  it('onBlurField on valid email has no error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
    })
    act(() => {
      result.current.onBlurField('identidad.email')
    })
    expect(result.current.errores['identidad.email']).toBeUndefined()
  })

  // validateTelefono + aviso de duplicado via onBlurField
  it('onBlurField on empty telefono publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.telefono')
    })
    expect(result.current.errores['identidad.telefono']).toBe(
      'El teléfono es requerido',
    )
  })

  it('does not call check when the telefono fails validation', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '123')
    })
    act(() => {
      result.current.onBlurField('identidad.telefono')
    })
    expect(mockCheck).not.toHaveBeenCalled()
  })

  it('avisoTelefono is null while there is a validation error on telefono', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('identidad.telefono')
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('sets avisoTelefono to the duplicado copy when check resolves enOtraFicha true', async () => {
    mockCheck.mockResolvedValue({ enOtraFicha: true, error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    act(() => {
      result.current.onBlurField('identidad.telefono')
    })
    await waitFor(() =>
      expect(result.current.avisoTelefono).toBe(AVISO_TELEFONO_DUPLICADO),
    )
  })

  it('leaves avisoTelefono null when check resolves enOtraFicha false', async () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    // The async `act` settles the in-flight `check(...)` so the assertion
    // below runs after the response, without spending this test's single
    // `expect` (testing.md Rule 1) on a synchronization barrier.
    await act(async () => {
      result.current.onBlurField('identidad.telefono')
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('leaves avisoTelefono null when check resolves with an error', async () => {
    mockCheck.mockResolvedValue({ enOtraFicha: true, error: 'no_autorizado' })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    await act(async () => {
      result.current.onBlurField('identidad.telefono')
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('discards a duplicado result if the telefono changed before check resolved', async () => {
    let resolveCheck!: (value: {
      enOtraFicha: boolean
      error: string | null
    }) => void
    mockCheck.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve
      }),
    )
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    act(() => {
      result.current.onBlurField('identidad.telefono')
    })
    act(() => {
      result.current.setIdentidadField('telefono', '+541159876543')
    })
    await act(async () => {
      resolveCheck({ enOtraFicha: true, error: null })
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('clears an existing avisoTelefono when the telefono changes', async () => {
    mockCheck.mockResolvedValue({ enOtraFicha: true, error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    await act(async () => {
      result.current.onBlurField('identidad.telefono')
    })
    const avisoAntes = result.current.avisoTelefono
    act(() => {
      result.current.setIdentidadField('telefono', '+541159876543')
    })
    // One assertion covers both halves: the aviso was really published by the
    // check, and editing the telefono cleared it (testing.md Rules 1 + 2).
    expect({
      antes: avisoAntes,
      despues: result.current.avisoTelefono,
    }).toEqual({ antes: AVISO_TELEFONO_DUPLICADO, despues: null })
  })

  // validateCausa, validateAlgoritmo, validateModalidad via onBlurField
  it('onBlurField on null causaId publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('diagnostico.causaId')
    })
    expect(result.current.errores['diagnostico.causaId']).toBe(
      'Seleccioná una causa raíz',
    )
  })

  it('onBlurField on set causaId clears error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setCausa('c-1')
    })
    act(() => {
      result.current.onBlurField('diagnostico.causaId')
    })
    expect(result.current.errores['diagnostico.causaId']).toBeUndefined()
  })

  it('onBlurField on null algoritmoId publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('diagnostico.algoritmoId')
    })
    expect(result.current.errores['diagnostico.algoritmoId']).toBe(
      'Seleccioná un algoritmo',
    )
  })

  it('onBlurField on null modalidadId publishes required error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.onBlurField('plan.modalidadId')
    })
    expect(result.current.errores['plan.modalidadId']).toBe(
      'Seleccioná una modalidad',
    )
  })

  // toggleBloqueo
  it('toggleBloqueo adds a bloqueo id', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    expect(result.current.formState.diagnostico.bloqueoIds).toEqual(['b-1'])
  })

  it('toggleBloqueo removes an already-present bloqueo id', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    act(() => {
      result.current.toggleBloqueo('b-1')
    })
    expect(result.current.formState.diagnostico.bloqueoIds).toEqual([])
  })

  // setAlfabetos
  it('setAlfabetos replaces the alfabetos with their numbers', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2, 5] }])
    })
    expect(result.current.formState.plan.alfabetos).toEqual([
      { alfabetoId: 'af-1', numeros: [2, 5] },
    ])
  })

  it('setAlfabetos with an empty list clears the alfabetos', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2] }])
    })
    act(() => {
      result.current.setAlfabetos([])
    })
    expect(result.current.formState.plan.alfabetos).toEqual([])
  })

  // puedeAvanzar paso 1
  it('puedeAvanzar is true on paso 1 when nombre and email are valid', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
    })
    expect(result.current.puedeAvanzar).toBe(true)
  })

  it('puedeAvanzar is false on paso 1 when email is empty', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      // email stays empty — the default
    })
    expect(result.current.puedeAvanzar).toBe(false)
  })

  it('puedeAvanzar is false on paso 1 when nombre is too short', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'A')
    })
    expect(result.current.puedeAvanzar).toBe(false)
  })

  it('puedeAvanzar is false on paso 1 when email is invalid', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'bademail')
    })
    expect(result.current.puedeAvanzar).toBe(false)
  })

  // puedeAvanzar paso 2
  it('puedeAvanzar is true on paso 2 when causa and algoritmo are set', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    // advance to paso 2 first
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
    })
    expect(result.current.puedeAvanzar).toBe(true)
  })

  it('puedeAvanzar is false on paso 2 when causaId is null', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.setAlgoritmo('a-1')
    })
    expect(result.current.puedeAvanzar).toBe(false)
  })

  // puedeAvanzar paso 3
  it('puedeAvanzar is true on paso 3 when modalidad is set', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
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

  // goNext
  it('goNext with invalid paso 1 does not advance', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.goNext()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('goNext with invalid paso 1 publishes nombre error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.goNext()
    })
    expect(result.current.errores['identidad.nombre']).toBe(
      'El nombre es requerido',
    )
  })

  it('goNext with valid paso 1 advances to paso 2', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    expect(result.current.formState.paso).toBe(2)
  })

  it('goNext with valid paso 1 clears errores', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    // trigger an error first
    act(() => {
      result.current.onBlurField('identidad.nombre')
    })
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    expect(result.current.errores).toEqual({})
  })

  it('goNext with invalid paso 2 does not advance', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.goNext()
    })
    expect(result.current.formState.paso).toBe(2)
  })

  it('goNext with invalid paso 2 publishes causa error', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.goNext()
    })
    expect(result.current.errores['diagnostico.causaId']).toBe(
      'Seleccioná una causa raíz',
    )
  })

  // goBack
  it('goBack from paso 2 returns to paso 1', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.goBack()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('goBack from paso 1 stays at paso 1', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.goBack()
    })
    expect(result.current.formState.paso).toBe(1)
  })

  // jumpToStep
  it('jumpToStep(1) from paso 3 returns to paso 1', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    // advance to paso 3
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
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

  it('jumpToStep(3) from paso 1 is a no-op', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.jumpToStep(3)
    })
    expect(result.current.formState.paso).toBe(1)
  })

  it('jumpToStep(2) from paso 2 is a no-op', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.goNext()
    })
    act(() => {
      result.current.jumpToStep(2)
    })
    expect(result.current.formState.paso).toBe(2)
  })

  // cancel
  it('cancel navigates to /pacientes when the guard lets it through', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.cancel()
    })
    expect(mockPush).toHaveBeenCalledWith('/pacientes')
  })

  // submit — success
  it('submit with all steps valid calls useRegisterPaciente.submit with correct payload', async () => {
    mockSubmit.mockResolvedValueOnce({ pacienteId: 'p-new', error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setIdentidadField('telefono', '+5491155550070')
    })
    act(() => {
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.toggleBloqueo('b-1')
    })
    act(() => {
      result.current.setModalidad('m-1')
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [2] }])
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).toHaveBeenCalledWith({
      nombre: 'Ana García',
      fechaNacimiento: '1990-06-15',
      email: 'ana@example.com',
      telefono: '+5491155550070',
      causaId: 'c-1',
      algoritmoId: 'a-1',
      modalidadId: 'm-1',
      bloqueoIds: ['b-1'],
      alfabetos: [{ alfabetoId: 'af-1', numeros: [2] }],
    })
  })

  it('submit success shows success toast', async () => {
    mockSubmit.mockResolvedValueOnce({ pacienteId: 'p-new', error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(toast.success).toHaveBeenCalledWith('Paciente cargado')
  })

  it('submit success redirects to asignar-contenido with paciente preselected', async () => {
    mockSubmit.mockResolvedValueOnce({ pacienteId: 'p-new', error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockPush).toHaveBeenCalledWith('/asignar-contenido?paciente=p-new')
  })

  it('submit with validation errors does not call register submit', async () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    // nombre and email are empty — should fail validation
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('submit blocks when email is empty (required field)', async () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      // email intentionally left empty
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(result.current.errores['identidad.email']).toBe(
      'El email es requerido',
    )
  })

  it('submit with RPC error shows error toast', async () => {
    mockSubmit.mockResolvedValueOnce({
      pacienteId: null,
      error: 'RPC failed',
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(toast.error).toHaveBeenCalledWith('RPC failed')
  })

  it('submit with RPC error does not redirect', async () => {
    mockSubmit.mockResolvedValueOnce({
      pacienteId: null,
      error: 'RPC failed',
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('isSubmitting reflects the register hook state', () => {
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: true,
      error: null,
      pacienteId: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.isSubmitting).toBe(true)
  })

  it('resets formState to initial defaults after a successful submit (PAC-004)', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: 'p-1', error: null })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())

    // Fill the wizard end-to-end and submit.
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.onSelectFechaNacimiento(new Date(1990, 4, 15, 12, 0))
      result.current.setCausa('c-1')
      result.current.toggleBloqueo('b-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
      result.current.setAlfabetos([{ alfabetoId: 'alf-1', numeros: [1] }])
    })

    await act(async () => {
      await result.current.submit()
    })

    // After success, the wizard must be back to step 1 with everything empty
    // so the next paciente starts clean (PAC-004).
    expect(result.current.formState).toEqual({
      paso: 1,
      identidad: {
        nombre: '',
        fechaNacimiento: null,
        email: '',
        telefono: '',
      },
      diagnostico: {
        causaId: null,
        bloqueoIds: [],
        algoritmoId: null,
      },
      plan: {
        modalidadId: null,
        alfabetos: [],
      },
    })
    expect(result.current.errores).toEqual({})
    expect(result.current.submitError).toBeNull()
  })

  it('does NOT reset formState after a failed submit (so user can fix and retry)', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'rpc_failed' })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())

    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })

    // State should be preserved so the terapeuta can fix and retry.
    expect(result.current.formState.identidad.nombre).toBe('Ana García')
    expect(result.current.formState.diagnostico.causaId).toBe('c-1')
  })

  it('submitError is null initially and after a successful submit', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: 'p-1', error: null })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.submitError).toBeNull()

    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBeNull()
  })

  it('submitError captures the RPC error returned by submit', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'algo falló' })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('algo falló')
  })

  it('submitError maps a known RPC error code to its friendly copy', async () => {
    mockSubmit.mockResolvedValue({
      pacienteId: null,
      error: 'telefono_invalido',
    })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe(
      'Teléfono inválido: tiene que ser un número argentino, con código de área y sin el 0 ni el 15.',
    )
  })

  it('submitError maps a known RPC error code thrown as an exception', async () => {
    mockSubmit.mockRejectedValue(new Error('fecha_nacimiento_requerida'))
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe(
      'La fecha de nacimiento es requerida.',
    )
  })

  it('submitError captures a thrown exception from submit', async () => {
    mockSubmit.mockRejectedValue(new Error('network unreachable'))
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('network unreachable')
  })

  it('dismissSubmitError clears submitError', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'algo falló' })
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.submitError).toBe('algo falló')
    act(() => {
      result.current.dismissSubmitError()
    })
    expect(result.current.submitError).toBeNull()
  })

  // double-submit guard
  it('submit while isSubmitting is true is a no-op even with valid form data', async () => {
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: true,
      error: null,
      pacienteId: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  // Verify waitFor import is used correctly in async cases
  it('submit with no error or pacienteId shows generic error toast', async () => {
    ;(useRegisterPaciente as jest.Mock).mockReturnValue({
      submit: mockSubmit,
      isSubmitting: false,
      error: null,
      pacienteId: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.setIdentidadField('fechaNacimiento', '1990-06-15')
      result.current.setCausa('c-1')
      result.current.setAlgoritmo('a-1')
      result.current.setModalidad('m-1')
    })
    await act(async () => {
      await result.current.submit()
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No se pudo cargar el paciente')
    })
  })
  it('fichaDuplicada is null before any submit', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.fichaDuplicada).toBeNull()
  })

  it("exposes the ficha that already has the email when it is the terapeuta's own", async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.fichaDuplicada).toEqual({
      id: 'pac-7',
      nombre: 'Sofía Rodríguez',
      accesible: true,
    })
  })

  it('names the own ficha in submitError on a duplicated email', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.submitError).toBe(
      'Ese email ya está en la ficha de Sofía Rodríguez',
    )
  })

  it('toasts the named message on a duplicated email of an own ficha', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(toast.error).toHaveBeenCalledWith(
      'Ese email ya está en la ficha de Sofía Rodríguez',
    )
  })

  it('looks the ficha up by the trimmed email, excluding no ficha', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result, '  sofia@example.com ')
    expect(mockBuscar).toHaveBeenCalledWith('sofia@example.com', null)
  })

  it('does not look any ficha up when the error is not a duplicated email', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'algo falló' })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(mockBuscar).not.toHaveBeenCalled()
  })

  it('shows the generic copy, naming nobody, when the ficha belongs to another terapeuta', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.submitError).toBe(
      'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
    )
  })

  it('leaves fichaDuplicada null when the ficha belongs to another terapeuta', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.fichaDuplicada).toBeNull()
  })

  it('uses the generic copy, with no ficha, for an ex-paciente whose asignación is closed', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Bianca Correa',
        dadoDeBaja: false,
        accesible: false,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect({
      mensaje: result.current.submitError,
      fichaDuplicada: result.current.fichaDuplicada,
    }).toEqual({
      mensaje:
        'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
      fichaDuplicada: null,
    })
  })

  it('still names a ficha with no open asignación when the user is an admin', async () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: { role: ROLE.ADMIN },
      isLoading: false,
      error: null,
    })
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Bianca Correa',
        dadoDeBaja: false,
        accesible: false,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.fichaDuplicada).toEqual({
      id: 'pac-7',
      nombre: 'Bianca Correa',
      accesible: false,
    })
  })

  it('uses the generic copy while the profile has not resolved yet', async () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Bianca Correa',
        dadoDeBaja: false,
        accesible: false,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.submitError).toBe(
      'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
    )
  })

  it('resolves the ficha too when email_duplicado arrives as a thrown exception', async () => {
    mockSubmit.mockRejectedValue(new Error('email_duplicado'))
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.fichaDuplicada).toEqual({
      id: 'pac-7',
      nombre: 'Sofía Rodríguez',
      accesible: true,
    })
  })

  it('shows a Spanish message when the email belongs to a paciente dado de baja', async () => {
    mockSubmit.mockResolvedValue({
      pacienteId: null,
      error: 'paciente_dado_de_baja',
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(result.current.submitError).toBe(
      'Ese email pertenece a un paciente que se dio de baja, así que no se puede usar en otra ficha.',
    )
  })

  it('dismissSubmitError clears fichaDuplicada', async () => {
    mockSubmit.mockResolvedValue({ pacienteId: null, error: 'email_duplicado' })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    act(() => {
      result.current.dismissSubmitError()
    })
    expect(result.current.fichaDuplicada).toBeNull()
  })

  it('clears a previous fichaDuplicada when the next submit fails for another reason', async () => {
    mockSubmit.mockResolvedValueOnce({
      pacienteId: null,
      error: 'email_duplicado',
    })
    mockBuscar.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    mockSubmit.mockResolvedValueOnce({ pacienteId: null, error: 'algo falló' })
    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.fichaDuplicada).toBeNull()
  })

  // guard de cambios sin guardar (BETA-047)
  it('no declara cambios sin guardar al abrir', () => {
    renderHook(() => useNuevoPacienteViewModel())
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('declara cambios sin guardar al escribir un dato', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana')
    })
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('deja de declarar cambios sin guardar cuando el paciente se cargó', async () => {
    mockSubmit.mockResolvedValueOnce({ pacienteId: 'p-new', error: null })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    await submitValidForm(result)
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('cancel pasa por el guard y no navega si el usuario no confirma', () => {
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: jest.fn(),
      hasUnsavedChanges: () => true,
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.cancel()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  // resumen de alfabetos
  it('submit translates numeros_invalidos into the Spanish copy', async () => {
    mockSubmit.mockResolvedValueOnce({
      pacienteId: null,
      error: 'numeros_invalidos',
    })
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setIdentidadField('nombre', 'Ana García')
      result.current.setIdentidadField('email', 'ana@example.com')
      result.current.setIdentidadField('telefono', '+5491155550070')
      result.current.onSelectFechaNacimiento(new Date(1990, 4, 15, 12, 0))
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

  it('el resumen lista los alfabetos con sus números', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'af-1', numeros: [15, 21] }])
    })
    expect(result.current.confirmationSummary.alfabetosDisplay).toBe(
      'Alfabeto 1 15, 21',
    )
  })

  it('el resumen dice "Sin alfabetos" sin ninguno', () => {
    const { result } = renderHook(() => useNuevoPacienteViewModel())
    expect(result.current.confirmationSummary.alfabetosDisplay).toBe(
      'Sin alfabetos',
    )
  })
})
