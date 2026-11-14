import { act, renderHook, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ROLE, useCurrentUserProfile } from '@/app/controllers/Auth'
import {
  useBuscarFichaPorEmail,
  useCheckTelefonoEnOtraFicha,
  useFetchPacienteEditData,
  useUpdatePacienteIdentidad,
  useUpdateEtapaDiagnostico,
  useSetEtapaAlfabetos,
} from '@/app/controllers/Paciente'
import type { PacienteEditData } from '@/app/controllers/Paciente'
import { useFetchAllDiagnosticos } from '@/app/controllers/Diagnostico'
import { AVISO_TELEFONO_DUPLICADO } from '@/lib/identidadMessages'
import {
  useNavigationGuard,
  useUnsavedChangesGuard,
} from '@/components/navigation'
import { useEditarPacienteViewModel } from './useEditarPacienteViewModel'

jest.mock('next/navigation')
jest.mock('@/app/controllers/Paciente')
jest.mock('@/app/controllers/Auth', () => ({
  ...jest.requireActual('@/app/controllers/Auth'),
  useCurrentUserProfile: jest.fn(),
}))
jest.mock('@/app/controllers/Diagnostico')
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))
jest.mock('@/components/navigation', () => ({
  useNavigationGuard: jest.fn(),
  useUnsavedChangesGuard: jest.fn(),
}))

const buildEditData = (
  overrides: Partial<PacienteEditData> = {},
): PacienteEditData => ({
  identidad: {
    nombre: 'Juan',
    fechaNacimiento: '1990-05-01',
    email: 'j@example.com',
    telefono: '+541155550070',
  },
  diagnostico: {
    causaId: 'causa-1',
    algoritmoId: 'algo-1',
    modalidadId: 'mod-1',
    bloqueoIds: ['b-1'],
    alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
  },
  etapaId: 'etapa-1',
  etapaFresca: true,
  tieneCuenta: false,
  ...overrides,
})

describe('useEditarPacienteViewModel', () => {
  let pushMock: jest.Mock
  let submitIdentidadMock: jest.Mock
  let submitDiagnosticoMock: jest.Mock
  let submitAlfabetosMock: jest.Mock
  let checkMock: jest.Mock
  let buscarMock: jest.Mock

  const setup = (editData: PacienteEditData | null, isLoading = false) => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'pac-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ push: pushMock })
    ;(useFetchPacienteEditData as jest.Mock).mockReturnValue({
      data: editData,
      isLoading,
      error: null,
    })
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: false,
      error: null,
    })
    ;(useUpdatePacienteIdentidad as jest.Mock).mockReturnValue({
      submit: submitIdentidadMock,
      isSubmitting: false,
    })
    ;(useUpdateEtapaDiagnostico as jest.Mock).mockReturnValue({
      submit: submitDiagnosticoMock,
      isSubmitting: false,
    })
    ;(useSetEtapaAlfabetos as jest.Mock).mockReturnValue({
      submit: submitAlfabetosMock,
      isSubmitting: false,
    })
    ;(useCheckTelefonoEnOtraFicha as jest.Mock).mockReturnValue({
      check: checkMock,
    })
    ;(useBuscarFichaPorEmail as jest.Mock).mockReturnValue({
      buscar: buscarMock,
    })
    return renderHook(() => useEditarPacienteViewModel())
  }

  // Lets the hydration effect and any in-flight `check(...)` promise settle
  // without spending the test's single `expect` (testing.md Rule 1) on a
  // synchronization barrier.
  const settle = () => act(async () => {})

  beforeEach(() => {
    pushMock = jest.fn()
    submitIdentidadMock = jest.fn().mockResolvedValue({ error: null })
    submitDiagnosticoMock = jest.fn().mockResolvedValue({ error: null })
    submitAlfabetosMock = jest.fn().mockResolvedValue({ error: null })
    checkMock = jest.fn().mockResolvedValue({ enOtraFicha: false, error: null })
    // Sin cambios pendientes el guard deja pasar la navegación en el acto.
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: (proceed: () => void) => proceed(),
      hasUnsavedChanges: () => false,
    })
    buscarMock = jest.fn().mockResolvedValue({ ficha: null, error: null })
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: { role: ROLE.TERAPEUTA },
      isLoading: false,
      error: null,
    })
    ;(toast.success as jest.Mock).mockClear()
    ;(toast.error as jest.Mock).mockClear()
  })

  it('reports isLoading while the edit data is being fetched', () => {
    const { result } = setup(null, true)
    expect(result.current.isLoading).toBe(true)
  })

  it('hydrates the identidad section from the fetched data', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => {
      expect(result.current.identidad).toEqual({
        nombre: 'Juan',
        fechaNacimiento: '1990-05-01',
        email: 'j@example.com',
        telefono: '1155550070',
      })
    })
  })

  it('hydrates the diagnostico section from the fetched data', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => {
      expect(result.current.diagnostico).toEqual({
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'mod-1',
        bloqueoIds: ['b-1'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
      })
    })
  })

  it('setAlfabetos replaces diagnostico.alfabetos', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() =>
      expect(result.current.diagnostico.causaId).toBe('causa-1'),
    )
    act(() => {
      result.current.setAlfabetos([
        { alfabetoId: 'a-1', numeros: [2, 4] },
        { alfabetoId: 'a-2', numeros: [7] },
      ])
    })
    expect(result.current.diagnostico.alfabetos).toEqual([
      { alfabetoId: 'a-1', numeros: [2, 4] },
      { alfabetoId: 'a-2', numeros: [7] },
    ])
  })

  it('diagnosticoDirty turns true when a number is added and false when reverted', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() =>
      expect(result.current.diagnostico.causaId).toBe('causa-1'),
    )
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2, 4] }])
    })
    expect(result.current.diagnosticoDirty).toBe(true)
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2] }])
    })
    expect(result.current.diagnosticoDirty).toBe(false)
  })

  it('normalizes null optional fields to empty strings on hydration', async () => {
    const { result } = setup(
      buildEditData({
        identidad: {
          nombre: 'Solo',
          fechaNacimiento: null,
          email: null,
          telefono: null,
        },
      }),
    )
    await waitFor(() => {
      expect(result.current.identidad).toEqual({
        nombre: 'Solo',
        fechaNacimiento: null,
        email: '',
        telefono: '',
      })
    })
  })

  it('exposes etapaFresca from the fetched data', async () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    await waitFor(() => {
      expect(result.current.etapaFresca).toBe(false)
    })
  })

  it('starts with identidadDirty false after hydration', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => {
      expect(result.current.identidadDirty).toBe(false)
    })
  })

  // aviso de teléfono duplicado (activacionPorTelefono Task 2.4)
  it('checks telefono en otra ficha exactly once on hydration', async () => {
    setup(buildEditData())
    await waitFor(() => expect(checkMock).toHaveBeenCalledTimes(1))
  })

  it('excludes the edited paciente from the hydration check', async () => {
    setup(buildEditData())
    await waitFor(() =>
      expect(checkMock).toHaveBeenCalledWith('1155550070', 'pac-1'),
    )
  })

  it('sets avisoTelefono from the hydration check when the phone is a duplicate', async () => {
    checkMock.mockResolvedValue({ enOtraFicha: true, error: null })
    const { result } = setup(buildEditData())
    await waitFor(() =>
      expect(result.current.avisoTelefono).toBe(AVISO_TELEFONO_DUPLICADO),
    )
  })

  it('does not check on hydration when the hydrated phone is empty', async () => {
    setup(
      buildEditData({
        identidad: {
          nombre: 'Juan',
          fechaNacimiento: '1990-05-01',
          email: 'j@example.com',
          telefono: null,
        },
      }),
    )
    await settle()
    expect(checkMock).not.toHaveBeenCalled()
  })

  it('avisoTelefono is null while there is a validation error on telefono', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('telefono', '')
    })
    act(() => {
      result.current.onBlurIdentidad('identidad.telefono')
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('does not call check again on blur when telefono fails validation', async () => {
    const { result } = setup(buildEditData())
    await settle()
    checkMock.mockClear()
    act(() => {
      result.current.setIdentidadField('telefono', '123')
    })
    act(() => {
      result.current.onBlurIdentidad('identidad.telefono')
    })
    expect(checkMock).not.toHaveBeenCalled()
  })

  it('sets avisoTelefono on blur when a new duplicate phone is entered', async () => {
    const { result } = setup(buildEditData())
    await settle()
    checkMock.mockResolvedValue({ enOtraFicha: true, error: null })
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    act(() => {
      result.current.onBlurIdentidad('identidad.telefono')
    })
    await waitFor(() =>
      expect(result.current.avisoTelefono).toBe(AVISO_TELEFONO_DUPLICADO),
    )
  })

  it('leaves avisoTelefono null when the blur check resolves with an error', async () => {
    const { result } = setup(buildEditData())
    await settle()
    checkMock.mockClear()
    checkMock.mockResolvedValue({ enOtraFicha: true, error: 'no_autorizado' })
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    await act(async () => {
      result.current.onBlurIdentidad('identidad.telefono')
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('discards a duplicado result if telefono changed before the blur check resolved', async () => {
    const { result } = setup(buildEditData())
    await settle()
    let resolveCheck!: (value: {
      enOtraFicha: boolean
      error: string | null
    }) => void
    checkMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve
      }),
    )
    act(() => {
      result.current.setIdentidadField('telefono', '+541151234567')
    })
    act(() => {
      result.current.onBlurIdentidad('identidad.telefono')
    })
    act(() => {
      result.current.setIdentidadField('telefono', '+541159876543')
    })
    await act(async () => {
      resolveCheck({ enOtraFicha: true, error: null })
    })
    expect(result.current.avisoTelefono).toBeNull()
  })

  it('clears an existing avisoTelefono when telefono changes', async () => {
    checkMock.mockResolvedValue({ enOtraFicha: true, error: null })
    const { result } = setup(buildEditData())
    await settle()
    const avisoAntes = result.current.avisoTelefono
    act(() => {
      result.current.setIdentidadField('telefono', '+541159876543')
    })
    // One assertion covers both halves: the hydration check really published
    // the aviso, and editing the telefono cleared it (testing.md Rules 1 + 2).
    expect({
      antes: avisoAntes,
      despues: result.current.avisoTelefono,
    }).toEqual({ antes: AVISO_TELEFONO_DUPLICADO, despues: null })
  })

  it('marks identidadDirty true after editing an identidad field', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    expect(result.current.identidadDirty).toBe(true)
  })

  it('blocks saveIdentidad and records an error when nombre is empty', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => {
      result.current.setIdentidadField('nombre', '')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(submitIdentidadMock).not.toHaveBeenCalled()
  })

  it('calls the identidad RPC with the normalized payload on a valid save', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(submitIdentidadMock).toHaveBeenCalledWith({
      pacienteId: 'pac-1',
      nombre: 'Juan',
      fechaNacimiento: '1990-05-01',
      email: 'j@example.com',
      telefono: '1155550070',
    })
  })

  // BETA-019: guardar una sección no navega ni descarta la otra.
  it('stays on the edit page after a successful identidad save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('leaves identidad clean and diagnostico still dirty after a successful identidad save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect({
      identidadDirty: result.current.identidadDirty,
      diagnosticoDirty: result.current.diagnosticoDirty,
      algoritmoId: result.current.diagnostico.algoritmoId,
    }).toEqual({
      identidadDirty: false,
      diagnosticoDirty: true,
      algoritmoId: 'algo-2',
    })
  })

  it('leaves identidad clean when the saved value had surrounding spaces', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', ' Juana ')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadDirty).toBe(false)
  })

  it('keeps the identidad changes and the section dirty when the save fails', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'no_autorizado' })
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect({
      nombre: result.current.identidad.nombre,
      identidadDirty: result.current.identidadDirty,
    }).toEqual({ nombre: 'Juana', identidadDirty: true })
  })

  it('keeps the identidad section dirty when the save throws', async () => {
    submitIdentidadMock.mockRejectedValue(new Error('network'))
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadDirty).toBe(true)
  })

  it('toasts the identidad save without description when diagnostico has no pending changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(toast.success).toHaveBeenCalledWith('Datos actualizados')
  })

  it('warns in the identidad toast that diagnostico still has unsaved changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(toast.success).toHaveBeenCalledWith('Datos actualizados', {
      description: 'El diagnóstico todavía tiene cambios sin guardar.',
    })
  })

  it('surfaces a friendly identidad error when the RPC returns no_autorizado', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'no_autorizado' })
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'No tenés permiso para editar este paciente',
    )
  })

  it('surfaces the DevSpec §7 copy when the identidad RPC returns telefono_invalido', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'telefono_invalido' })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'Teléfono inválido: tiene que ser un número argentino, con código de área y sin el 0 ni el 15.',
    )
  })

  it('surfaces the DevSpec §7 copy when the identidad RPC returns fecha_nacimiento_requerida', async () => {
    submitIdentidadMock.mockResolvedValue({
      error: 'fecha_nacimiento_requerida',
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'La fecha de nacimiento es requerida.',
    )
  })

  it('shows the raw code when the identidad RPC returns a code named like an Object.prototype member', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'constructor' })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe('constructor')
  })

  it('surfaces the Spanish copy when the identidad RPC returns email_bloqueado_por_cuenta', async () => {
    submitIdentidadMock.mockResolvedValue({
      error: 'email_bloqueado_por_cuenta',
    })
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('nombre', 'Juan Pablo'))
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'No se puede cambiar el email: el paciente ya activó su cuenta.',
    )
  })

  it('emailBloqueado is false while the paciente has not activated the account', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: false }))
    await settle()
    expect(result.current.emailBloqueado).toBe(false)
  })

  it('emailBloqueado is true once the paciente activated the account', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: true }))
    await settle()
    expect(result.current.emailBloqueado).toBe(true)
  })

  it('emailBloqueado is false before the edit data arrives', () => {
    const { result } = setup(null, true)
    expect(result.current.emailBloqueado).toBe(false)
  })

  it('ignores an email change while the email is bloqueado', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: true }))
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('email', 'otro@example.com'))
    expect(result.current.identidad.email).toBe('j@example.com')
  })

  it('keeps identidadDirty false after an ignored email change', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: true }))
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('email', 'otro@example.com'))
    expect(result.current.identidadDirty).toBe(false)
  })

  it('still lets the other identidad fields change while the email is bloqueado', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: true }))
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('nombre', 'Juan Pablo'))
    expect(result.current.identidadDirty).toBe(true)
  })

  it('sends the email of the ficha untouched when saving with the email bloqueado', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: true }))
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('email', 'otro@example.com'))
    act(() => result.current.setIdentidadField('nombre', 'Juan Pablo'))
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(submitIdentidadMock).toHaveBeenCalledWith({
      pacienteId: 'pac-1',
      nombre: 'Juan Pablo',
      fechaNacimiento: '1990-05-01',
      email: 'j@example.com',
      telefono: '1155550070',
    })
  })

  it('lets the email change while the paciente has no account', async () => {
    const { result } = setup(buildEditData({ tieneCuenta: false }))
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => result.current.setIdentidadField('email', 'otro@example.com'))
    expect(result.current.identidad.email).toBe('otro@example.com')
  })

  it('registers the unsaved-changes guard as clean when nothing was edited', async () => {
    setup(buildEditData())
    await settle()
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(false)
  })

  it('registers the unsaved-changes guard as dirty when identidad has pending changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => result.current.setIdentidadField('email', 'otro@example.com'))
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('registers the unsaved-changes guard as dirty when diagnóstico has pending changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => result.current.setCausa('otra-causa'))
    expect(useUnsavedChangesGuard).toHaveBeenLastCalledWith(true)
  })

  it('fichaDuplicada is null before any save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    expect(result.current.fichaDuplicada).toBeNull()
  })

  it('exposes the own ficha that already has the email when the identidad save hits email_duplicado', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.fichaDuplicada).toEqual({
      id: 'pac-7',
      nombre: 'Sofía Rodríguez',
      accesible: true,
    })
  })

  it('names the own ficha in identidadSaveError on a duplicated email', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'Ese email ya está en la ficha de Sofía Rodríguez',
    )
  })

  it('looks the ficha up by the trimmed email, excluding the edited paciente', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('email', ' sofia@example.com ')
    })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(buscarMock).toHaveBeenCalledWith('sofia@example.com', 'pac-1')
  })

  it('shows the generic copy when the duplicated email is on a ficha of another terapeuta', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
    )
  })

  it('shows the generic copy, without a ficha, for an ex-paciente dado de baja with no open asignación', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: true,
        accesible: false,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect({
      mensaje: result.current.identidadSaveError,
      fichaDuplicada: result.current.fichaDuplicada,
    }).toEqual({
      mensaje:
        'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
      fichaDuplicada: null,
    })
  })

  it('shows the generic copy, without a ficha, for an ex-paciente whose asignación is closed', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Bianca Correa',
        dadoDeBaja: false,
        accesible: false,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect({
      mensaje: result.current.identidadSaveError,
      fichaDuplicada: result.current.fichaDuplicada,
    }).toEqual({
      mensaje:
        'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
      fichaDuplicada: null,
    })
  })

  it('keeps the baja copy for an admin when the ficha is dada de baja', async () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: { role: ROLE.ADMIN },
      isLoading: false,
      error: null,
    })
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: true,
        accesible: false,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.identidadSaveError).toBe(
      'Ese email pertenece a un paciente que se dio de baja, así que no se puede usar en otra ficha.',
    )
  })

  it('still names a ficha with no open asignación when the user is an admin', async () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: { role: ROLE.ADMIN },
      isLoading: false,
      error: null,
    })
    submitIdentidadMock.mockResolvedValue({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Bianca Correa',
        dadoDeBaja: false,
        accesible: false,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.fichaDuplicada).toEqual({
      id: 'pac-7',
      nombre: 'Bianca Correa',
      accesible: false,
    })
  })

  it('clears a previous fichaDuplicada when the next identidad save fails for another reason', async () => {
    submitIdentidadMock.mockResolvedValueOnce({ error: 'email_duplicado' })
    buscarMock.mockResolvedValue({
      ficha: {
        id: 'pac-7',
        nombre: 'Sofía Rodríguez',
        dadoDeBaja: false,
        accesible: true,
      },
      error: null,
    })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    submitIdentidadMock.mockResolvedValueOnce({ error: 'no_autorizado' })
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(result.current.fichaDuplicada).toBeNull()
  })

  it('does not look any ficha up when the identidad error is not a duplicated email', async () => {
    submitIdentidadMock.mockResolvedValue({ error: 'no_autorizado' })
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveIdentidad()
    })
    expect(buscarMock).not.toHaveBeenCalled()
  })

  it('calls the diagnostico RPC with the payload on a valid save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(submitDiagnosticoMock).toHaveBeenCalledWith({
      pacienteId: 'pac-1',
      causaId: 'causa-1',
      algoritmoId: 'algo-1',
      modalidadId: 'mod-1',
      bloqueoIds: ['b-1'],
      alfabetos: [{ alfabetoId: 'a-1', numeros: [2] }],
    })
  })

  it('stays on the edit page after a successful diagnostico save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('leaves diagnostico clean and identidad still dirty after a successful diagnostico save', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect({
      identidadDirty: result.current.identidadDirty,
      diagnosticoDirty: result.current.diagnosticoDirty,
      nombre: result.current.identidad.nombre,
    }).toEqual({
      identidadDirty: true,
      diagnosticoDirty: false,
      nombre: 'Juana',
    })
  })

  it('keeps the diagnostico changes and the section dirty when the save fails', async () => {
    submitDiagnosticoMock.mockResolvedValue({ error: 'etapa_con_progreso' })
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect({
      algoritmoId: result.current.diagnostico.algoritmoId,
      diagnosticoDirty: result.current.diagnosticoDirty,
    }).toEqual({ algoritmoId: 'algo-2', diagnosticoDirty: true })
  })

  it('translates numeros_invalidos when saving the diagnostico fails', async () => {
    submitDiagnosticoMock.mockResolvedValue({ error: 'numeros_invalidos' })
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(result.current.diagnosticoSaveError).toBe(
      'Revisá los números de los alfabetos.',
    )
  })

  it('toasts the diagnostico save without description when identidad has no pending changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(toast.success).toHaveBeenCalledWith('Diagnóstico actualizado')
  })

  it('warns in the diagnostico toast that identidad still has unsaved changes', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
      result.current.setAlgoritmo('algo-2')
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(toast.success).toHaveBeenCalledWith('Diagnóstico actualizado', {
      description: 'Los datos personales todavía tienen cambios sin guardar.',
    })
  })

  it('does not call the diagnostico RPC when the etapa is not fresca', async () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    await waitFor(() =>
      expect(result.current.diagnostico.causaId).toBe('causa-1'),
    )
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(submitDiagnosticoMock).not.toHaveBeenCalled()
  })

  it('surfaces a friendly diagnostico error when the RPC reports progress', async () => {
    submitDiagnosticoMock.mockResolvedValue({ error: 'etapa_con_progreso' })
    const { result } = setup(buildEditData())
    await waitFor(() =>
      expect(result.current.diagnostico.causaId).toBe('causa-1'),
    )
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(result.current.diagnosticoSaveError).toBe(
      'No se puede corregir el diagnóstico: el tratamiento del paciente ya arrancó',
    )
  })

  it('alfabetosEditables is true when the paciente has an active etapa', () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    expect(result.current.alfabetosEditables).toBe(true)
  })

  it('alfabetosEditables is false when the paciente has no active etapa', () => {
    const { result } = setup(buildEditData({ etapaId: null }))
    expect(result.current.alfabetosEditables).toBe(false)
  })

  it('footerAction is identidad on paso 1', () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    expect(result.current.footerAction).toBe('identidad')
  })

  it('footerAction is diagnostico on paso 2 when the etapa is fresca', () => {
    const { result } = setup(buildEditData({ etapaFresca: true }))
    act(() => {
      result.current.jumpToStep(2)
    })
    expect(result.current.footerAction).toBe('diagnostico')
  })

  it('footerAction is diagnostico on paso 3 when the etapa is fresca', () => {
    const { result } = setup(buildEditData({ etapaFresca: true }))
    act(() => {
      result.current.jumpToStep(3)
    })
    expect(result.current.footerAction).toBe('diagnostico')
  })

  it('footerAction is null on paso 2 when the diagnostico is locked', () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    act(() => {
      result.current.jumpToStep(2)
    })
    expect(result.current.footerAction).toBeNull()
  })

  it('footerAction is alfabetos on paso 3 when the diagnostico is locked', () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    act(() => {
      result.current.jumpToStep(3)
    })
    expect(result.current.footerAction).toBe('alfabetos')
  })

  it('footerAction is null on paso 3 without an active etapa', () => {
    const { result } = setup(
      buildEditData({ etapaId: null, etapaFresca: false }),
    )
    act(() => {
      result.current.jumpToStep(3)
    })
    expect(result.current.footerAction).toBeNull()
  })

  it('saveAlfabetos sends the alfabetos through set_etapa_alfabetos', async () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    await settle()
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2, 4] }])
    })
    await act(async () => {
      await result.current.saveAlfabetos()
    })
    expect(submitAlfabetosMock).toHaveBeenCalledWith({
      pacienteId: 'pac-1',
      alfabetos: [{ alfabetoId: 'a-1', numeros: [2, 4] }],
    })
  })

  it('saveAlfabetos toasts success and leaves diagnostico clean', async () => {
    const { result } = setup(buildEditData({ etapaFresca: false }))
    await settle()
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2, 4] }])
    })
    await act(async () => {
      await result.current.saveAlfabetos()
    })
    expect({
      toasted: (toast.success as jest.Mock).mock.calls[0][0],
      diagnosticoDirty: result.current.diagnosticoDirty,
    }).toEqual({ toasted: 'Alfabetos actualizados.', diagnosticoDirty: false })
  })

  it('saveAlfabetos with numeros_invalidos toasts the message and keeps the form', async () => {
    submitAlfabetosMock.mockResolvedValue({ error: 'numeros_invalidos' })
    const { result } = setup(buildEditData({ etapaFresca: false }))
    await settle()
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2, 4] }])
    })
    await act(async () => {
      await result.current.saveAlfabetos()
    })
    expect({
      toasted: (toast.error as jest.Mock).mock.calls[0][0],
      alfabetos: result.current.diagnostico.alfabetos,
      diagnosticoDirty: result.current.diagnosticoDirty,
    }).toEqual({
      toasted: 'Revisá los números de los alfabetos.',
      alfabetos: [{ alfabetoId: 'a-1', numeros: [2, 4] }],
      diagnosticoDirty: true,
    })
  })

  it('saveAlfabetos does nothing when the etapa is fresca', async () => {
    const { result } = setup(buildEditData({ etapaFresca: true }))
    await settle()
    await act(async () => {
      await result.current.saveAlfabetos()
    })
    expect(submitAlfabetosMock).not.toHaveBeenCalled()
  })

  it('saveAlfabetos does nothing when there is no active etapa', async () => {
    const { result } = setup(
      buildEditData({ etapaId: null, etapaFresca: false }),
    )
    await settle()
    await act(async () => {
      await result.current.saveAlfabetos()
    })
    expect(submitAlfabetosMock).not.toHaveBeenCalled()
  })

  it('saveDiagnostico with a fresca etapa still sends the alfabetos by update_etapa_diagnostico', async () => {
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setAlfabetos([{ alfabetoId: 'a-1', numeros: [2, 4] }])
    })
    await act(async () => {
      await result.current.saveDiagnostico()
    })
    expect(submitDiagnosticoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        alfabetos: [{ alfabetoId: 'a-1', numeros: [2, 4] }],
      }),
    )
  })

  it('navigates back to the paciente detail on cancel', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => {
      result.current.cancel()
    })
    expect(pushMock).toHaveBeenCalledWith('/pacientes/pac-1/camino')
  })

  it('does not leave on cancel while the navigation guard holds the exit', async () => {
    ;(useNavigationGuard as jest.Mock).mockReturnValue({
      guardNavigation: jest.fn(),
      hasUnsavedChanges: () => true,
    })
    const { result } = setup(buildEditData())
    await settle()
    act(() => {
      result.current.setIdentidadField('nombre', 'Juana')
    })
    act(() => {
      result.current.cancel()
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('re-hydrates the form when the route switches to a different paciente', async () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'pac-1' })
    ;(useRouter as jest.Mock).mockReturnValue({ push: pushMock })
    ;(useFetchAllDiagnosticos as jest.Mock).mockReturnValue({
      diagnosticos: null,
      isLoading: false,
      error: null,
    })
    ;(useUpdatePacienteIdentidad as jest.Mock).mockReturnValue({
      submit: submitIdentidadMock,
      isSubmitting: false,
    })
    ;(useUpdateEtapaDiagnostico as jest.Mock).mockReturnValue({
      submit: submitDiagnosticoMock,
      isSubmitting: false,
    })
    ;(useFetchPacienteEditData as jest.Mock).mockReturnValue({
      data: buildEditData(),
      isLoading: false,
      error: null,
    })
    const { result, rerender } = renderHook(() => useEditarPacienteViewModel())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    ;(useParams as jest.Mock).mockReturnValue({ id: 'pac-2' })
    ;(useFetchPacienteEditData as jest.Mock).mockReturnValue({
      data: buildEditData({
        identidad: {
          nombre: 'Pedro',
          fechaNacimiento: null,
          email: null,
          telefono: null,
        },
      }),
      isLoading: false,
      error: null,
    })
    rerender()
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Pedro'))
  })

  it('starts on paso 1', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    expect(result.current.paso).toBe(1)
  })

  it('jumps to an earlier paso with jumpToStep', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => {
      result.current.jumpToStep(3)
    })
    act(() => {
      result.current.jumpToStep(1)
    })
    expect(result.current.paso).toBe(1)
  })

  it('jumps forward to any paso with jumpToStep (free tab nav)', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    act(() => {
      result.current.jumpToStep(3)
    })
    expect(result.current.paso).toBe(3)
  })

  it('marks every non-active paso as done so the stepper allows free jumps', async () => {
    const { result } = setup(buildEditData())
    await waitFor(() => expect(result.current.identidad.nombre).toBe('Juan'))
    expect(result.current.pasos.map((p) => p.status)).toEqual([
      'active',
      'done',
      'done',
    ])
  })
})
