import { renderHook, act } from '@testing-library/react'
import { useUpdateTerapeuta } from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'
import { ROLE } from '@/app/controllers/Auth'
import { useEditarTerapeutaViewModel } from './useEditarTerapeutaViewModel'

jest.mock('@/app/controllers/Terapeuta', () => ({
  ...jest.requireActual('@/app/controllers/Terapeuta'),
  useUpdateTerapeuta: jest.fn(),
}))

describe('useEditarTerapeutaViewModel', () => {
  let mockMutate: jest.Mock
  let terapeutaFixture: Terapeuta

  beforeEach(() => {
    terapeutaFixture = {
      id: 't-1',
      profile: {
        id: 'u-1',
        name: 'Dr. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'ana@test.com',
      },
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@test.com',
      telefono: '+54 11 1234-5678',
      pacientesActivos: 2,
    }
    mockMutate = jest.fn().mockResolvedValue({ ok: true })
    ;(useUpdateTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null,
    })
  })

  it('initializes nombre from target.profile.name', () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    expect(result.current.nombre).toBe('Dr. Ana')
  })

  it('initializes telefono from target.telefono', () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    expect(result.current.telefono).toBe('+54 11 1234-5678')
  })

  it('initializes telefono as empty string when target.telefono is null', () => {
    terapeutaFixture = { ...terapeutaFixture, telefono: null }
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    expect(result.current.telefono).toBe('')
  })

  it('resets nombre from new target when target.id changes', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: Terapeuta }) =>
        useEditarTerapeutaViewModel(target),
      { initialProps: { target: terapeutaFixture } },
    )
    const newTarget: Terapeuta = {
      ...terapeutaFixture,
      id: 't-2',
      profile: { ...terapeutaFixture.profile, name: 'Dr. Bruno' },
      telefono: '+54 9 8765-4321',
    }
    act(() => {
      rerender({ target: newTarget })
    })
    expect(result.current.nombre).toBe('Dr. Bruno')
  })

  it('resets telefono from new target when target.id changes', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: Terapeuta }) =>
        useEditarTerapeutaViewModel(target),
      { initialProps: { target: terapeutaFixture } },
    )
    const newTarget: Terapeuta = {
      ...terapeutaFixture,
      id: 't-2',
      profile: { ...terapeutaFixture.profile, name: 'Dr. Bruno' },
      telefono: '+54 9 8765-4321',
    }
    act(() => {
      rerender({ target: newTarget })
    })
    expect(result.current.telefono).toBe('+54 9 8765-4321')
  })

  it('submit with empty nombre returns ok:false', async () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    act(() => result.current.onNombreChange('   '))
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.onSubmit()
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('submit with empty nombre sets nombreError to "Ingresá un nombre."', async () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    act(() => result.current.onNombreChange(''))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.nombreError).toBe('Ingresá un nombre.')
  })

  it('submit returning ok:false with nombre_vacio error sets submitError to mapped message', async () => {
    mockMutate.mockResolvedValue({ ok: false })
    ;(useUpdateTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: 'nombre_vacio',
    })
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe('El nombre no puede estar vacío.')
  })

  it('submit returning ok:false with unknown error sets submitError to generic message', async () => {
    mockMutate.mockResolvedValue({ ok: false })
    ;(useUpdateTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: 'unexpected_error',
    })
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current.submitError).toBe(
      'No se pudo actualizar el terapeuta. Intentá de nuevo.',
    )
  })

  it('submit with valid nombre calls mutate and returns ok:true', async () => {
    mockMutate.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.onSubmit()
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('onNombreChange clears nombreError', async () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    act(() => result.current.onNombreChange(''))
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => result.current.onNombreChange('Dr. Ana'))
    expect(result.current.nombreError).toBeNull()
  })

  it('onReset with initial values resets nombre and telefono', async () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    act(() => {
      result.current.onNombreChange('Modificado')
      result.current.onTelefonoChange('999')
    })
    act(() => {
      result.current.onReset({ nombre: 'Original', telefono: '111' })
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombre: 'Original',
        telefono: '111',
        nombreError: null,
        submitError: null,
        isSubmitting: false,
      }),
    )
  })

  it('onReset without arguments resets nombre and telefono to empty strings', async () => {
    const { result } = renderHook(() =>
      useEditarTerapeutaViewModel(terapeutaFixture),
    )
    act(() => {
      result.current.onNombreChange('Modificado')
    })
    act(() => {
      result.current.onReset()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombre: '',
        telefono: '',
        nombreError: null,
        submitError: null,
        isSubmitting: false,
      }),
    )
  })

  it('clears nombreError when target.id changes', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: Terapeuta }) =>
        useEditarTerapeutaViewModel(target),
      { initialProps: { target: terapeutaFixture } },
    )
    // Trigger a nombreError
    await act(async () => {
      act(() => result.current.onNombreChange(''))
      await result.current.onSubmit()
    })
    const newTarget: Terapeuta = {
      ...terapeutaFixture,
      id: 't-2',
      profile: { ...terapeutaFixture.profile, name: 'Dr. Bruno' },
    }
    act(() => {
      rerender({ target: newTarget })
    })
    expect(result.current.nombreError).toBeNull()
  })
})
