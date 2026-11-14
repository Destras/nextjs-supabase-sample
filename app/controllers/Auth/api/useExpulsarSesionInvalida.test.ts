import { act, renderHook, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useExpulsarSesionInvalida } from './useExpulsarSesionInvalida'
import { verificarSesionDeConsola } from './verificarSesionDeConsola'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/lib/supabase/client')
jest.mock('./verificarSesionDeConsola')

describe('useExpulsarSesionInvalida', () => {
  let replace: jest.Mock
  let signOut: jest.Mock

  beforeEach(() => {
    replace = jest.fn()
    signOut = jest.fn().mockResolvedValue({ error: null })
    ;(useRouter as jest.Mock).mockReturnValue({ replace })
    ;(createClient as jest.Mock).mockReturnValue({ auth: { signOut } })
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue(null)
  })

  it('no navega mientras la sesión sigue vigente', async () => {
    renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await act(async () => {})
    expect(replace).not.toHaveBeenCalled()
  })

  it('no oculta el panel mientras la sesión sigue vigente', async () => {
    const { result } = renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await act(async () => {})
    expect(result.current).toEqual({ expulsando: false })
  })

  it('lleva al login con el motivo cuando la sesión ya no vale', async () => {
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue(
      'sesion_terminada',
    )
    renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/auth/login?error=sesion_terminada')
    })
  })

  it('cierra solo la sesión de este navegador', async () => {
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue('sin_acceso')
    renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    })
  })

  it('oculta el panel mientras expulsa', async () => {
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue('sin_acceso')
    const { result } = renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await waitFor(() => {
      expect(result.current).toEqual({ expulsando: true })
    })
  })

  it('lleva al login aunque el cierre de sesión falle', async () => {
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue('sin_acceso')
    signOut.mockRejectedValue(new Error('network'))
    renderHook(() =>
      useExpulsarSesionInvalida({ activo: true, pathname: '/pacientes' }),
    )
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/auth/login?error=sin_acceso')
    })
  })

  it('no verifica nada en las pantallas de auth', () => {
    renderHook(() =>
      useExpulsarSesionInvalida({ activo: false, pathname: '/auth/login' }),
    )
    expect(verificarSesionDeConsola).not.toHaveBeenCalled()
  })

  it('vuelve a verificar al cambiar de pantalla', async () => {
    const { rerender } = renderHook(
      ({ pathname }) => useExpulsarSesionInvalida({ activo: true, pathname }),
      { initialProps: { pathname: '/' } },
    )
    rerender({ pathname: '/pacientes' })
    await waitFor(() => {
      expect(verificarSesionDeConsola).toHaveBeenCalledTimes(2)
    })
  })

  it('deja de ocultar el panel al llegar al login', async () => {
    ;(verificarSesionDeConsola as jest.Mock).mockResolvedValue('sin_acceso')
    const { result, rerender } = renderHook(
      ({ activo, pathname }) => useExpulsarSesionInvalida({ activo, pathname }),
      { initialProps: { activo: true, pathname: '/pacientes' } },
    )
    await act(async () => {})
    rerender({ activo: false, pathname: '/auth/login' })
    expect(result.current).toEqual({ expulsando: false })
  })
})
