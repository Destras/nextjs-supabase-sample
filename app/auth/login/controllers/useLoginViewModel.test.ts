import { act, renderHook } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type React from 'react'
import { useLoginViewModel } from './useLoginViewModel'

jest.mock('@/lib/supabase/client')
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

describe('useLoginViewModel', () => {
  let signInWithPassword: jest.Mock
  let routerPush: jest.Mock
  let routerReplace: jest.Mock

  beforeEach(() => {
    signInWithPassword = jest.fn()
    routerPush = jest.fn()
    routerReplace = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      auth: { signInWithPassword },
    })
    ;(useRouter as jest.Mock).mockReturnValue({
      push: routerPush,
      replace: routerReplace,
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it('explica que la cuenta no tiene acceso cuando el proxy la rechazó', () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('error=sin_acceso'),
    )
    const { result } = renderHook(() => useLoginViewModel())
    expect(result.current).toEqual(
      expect.objectContaining({
        error:
          'Esta cuenta no tiene acceso al panel. Si sos paciente, usá la app.',
      }),
    )
  })

  it('muestra el rechazo cuando la URL cambia con el login ya abierto', () => {
    const { result, rerender } = renderHook(() => useLoginViewModel())
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('error=sin_acceso'),
    )
    rerender()
    expect(result.current).toEqual(
      expect.objectContaining({
        error:
          'Esta cuenta no tiene acceso al panel. Si sos paciente, usá la app.',
      }),
    )
  })

  // BETA-044: el rechazo de la URL es de la cuenta anterior. Si otra cuenta
  // intenta entrar, no tiene que seguir en pantalla mientras se envía.
  it('saca el error de la URL al enviar', async () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('error=sin_acceso'),
    )
    signInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useLoginViewModel())
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(routerReplace).toHaveBeenCalledWith('/auth/login', { scroll: false })
  })

  it('no toca la URL al enviar cuando no trae un error', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useLoginViewModel())
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('no muestra el rechazo de la URL mientras se está enviando', async () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('error=sin_acceso'),
    )
    signInWithPassword.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useLoginViewModel())
    act(() => {
      void result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(result.current.error).toBeNull()
  })

  it('no muestra un error cuando la URL trae un código desconocido', () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('error=cualquier_cosa<script>'),
    )
    const { result } = renderHook(() => useLoginViewModel())
    expect(result.current).toEqual(expect.objectContaining({ error: null }))
  })

  it('returns the initial state with empty fields and no error', () => {
    const { result } = renderHook(() => useLoginViewModel())
    expect(result.current).toEqual({
      email: '',
      password: '',
      error: null,
      isLoading: false,
      onEmailChange: expect.any(Function),
      onPasswordChange: expect.any(Function),
      onSubmit: expect.any(Function),
      onForgotPassword: expect.any(Function),
    })
  })

  it('updates email when onEmailChange is called', () => {
    const { result } = renderHook(() => useLoginViewModel())
    act(() => {
      result.current.onEmailChange('test@example.com')
    })
    expect(result.current).toEqual(
      expect.objectContaining({ email: 'test@example.com' }),
    )
  })

  it('updates password when onPasswordChange is called', () => {
    const { result } = renderHook(() => useLoginViewModel())
    act(() => {
      result.current.onPasswordChange('secret123')
    })
    expect(result.current).toEqual(
      expect.objectContaining({ password: 'secret123' }),
    )
  })

  it('redirects to "/auth/forgot-password" when onForgotPassword is called', () => {
    const { result } = renderHook(() => useLoginViewModel())
    act(() => {
      result.current.onForgotPassword()
    })
    expect(routerPush).toHaveBeenCalledWith('/auth/forgot-password')
  })

  it('redirects to "/" when login succeeds', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useLoginViewModel())
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(routerPush).toHaveBeenCalledWith('/')
  })

  it('sets the error in Spanish when supabase rejects the credentials', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Invalid login credentials'), {
        code: 'invalid_credentials',
      }),
    })
    const { result } = renderHook(() => useLoginViewModel())
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        error: 'El correo o la contraseña no son correctos.',
        isLoading: false,
      }),
    )
  })

  it('sets a generic error message when a non-Error is thrown during login', async () => {
    signInWithPassword.mockRejectedValue('network failure')
    const { result } = renderHook(() => useLoginViewModel())
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent)
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        error: 'Algo salió mal. Probá de nuevo.',
        isLoading: false,
      }),
    )
  })
})
