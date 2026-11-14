import { renderHook, act } from '@testing-library/react'
import { useInviteTerapeuta } from '@/app/controllers/Terapeuta'
import { useInvitarTerapeutaViewModel } from './useInvitarTerapeutaViewModel'

jest.mock('@/app/controllers/Terapeuta', () => ({
  ...jest.requireActual('@/app/controllers/Terapeuta'),
  useInviteTerapeuta: jest.fn(),
}))

describe('useInvitarTerapeutaViewModel', () => {
  let mockMutate: jest.Mock

  beforeEach(() => {
    mockMutate = jest.fn().mockResolvedValue({ ok: true, terapeutaId: 't-1' })
    ;(useInviteTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:true and all errors null after a successful submit with valid nombre and email', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.onSubmit()
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('clears errors and sets isSubmitting:false after a successful submit', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombreError: null,
        emailError: null,
        submitError: null,
        isSubmitting: false,
      }),
    )
  })

  it('returns ok:false and sets nombreError when nombre is empty', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('   ')
      result.current.onEmailChange('ana@clinic.com')
    })
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.onSubmit()
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets nombreError and keeps emailError null when nombre is empty on submit', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombreError: expect.any(String),
        emailError: null,
      }),
    )
  })

  it('returns ok:false and sets emailError when email is invalid', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('not-an-email')
    })
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.onSubmit()
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets emailError and keeps nombreError null when email is invalid on submit', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('bad-email')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombreError: null,
        emailError: expect.any(String),
      }),
    )
  })

  it('sets submitError to email_duplicado message when mutate returns ok:false with email_duplicado', async () => {
    mockMutate.mockResolvedValue({ ok: false, error: 'email_duplicado' })
    ;(useInviteTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        submitError: 'Ese email ya está registrado en el sistema.',
      }),
    )
  })

  it('sets submitError to generic message when mutate returns ok:false with unknown error', async () => {
    mockMutate.mockResolvedValue({ ok: false, error: 'network_error' })
    ;(useInviteTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        submitError: 'No pudimos enviar la invitación. Intentá de nuevo.',
      }),
    )
  })

  it('clears nombreError when onNombreChange is called', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    // Trigger nombreError by submitting with empty nombre
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => {
      result.current.onNombreChange('Ana')
    })
    expect(result.current).toEqual(
      expect.objectContaining({ nombreError: null }),
    )
  })

  it('clears emailError when onEmailChange is called', async () => {
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('bad-email')
    })
    // Trigger emailError
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => {
      result.current.onEmailChange('ana@clinic.com')
    })
    expect(result.current).toEqual(
      expect.objectContaining({ emailError: null }),
    )
  })

  it('resets nombre, email and all errors when onReset is called', async () => {
    mockMutate.mockResolvedValue({ ok: false })
    ;(useInviteTerapeuta as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      error: 'network_error',
    })
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => {
      result.current.onReset()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        nombre: '',
        email: '',
        nombreError: null,
        emailError: null,
        submitError: null,
        isSubmitting: false,
      }),
    )
  })

  it('clears submitError when the email changes after a rejected submit (BETA-038)', async () => {
    mockMutate.mockResolvedValue({ ok: false, error: 'email_duplicado' })
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => {
      result.current.onEmailChange('otra@clinic.com')
    })
    expect(result.current.submitError).toBeNull()
  })

  it('clears submitError when the nombre changes after a rejected submit (BETA-038)', async () => {
    mockMutate.mockResolvedValue({ ok: false, error: 'validacion_invalida' })
    const { result } = renderHook(() => useInvitarTerapeutaViewModel())
    act(() => {
      result.current.onNombreChange('Ana García')
      result.current.onEmailChange('ana@clinic.com')
    })
    await act(async () => {
      await result.current.onSubmit()
    })
    act(() => {
      result.current.onNombreChange('Ana G.')
    })
    expect(result.current.submitError).toBeNull()
  })
})
