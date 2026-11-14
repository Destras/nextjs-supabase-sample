import type { SupabaseClient } from '@supabase/supabase-js'
import { verificarSesionDeConsola } from './verificarSesionDeConsola'

describe('verificarSesionDeConsola', () => {
  let getUser: jest.Mock
  let rpc: jest.Mock
  let supabase: SupabaseClient

  beforeEach(() => {
    getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    rpc = jest.fn().mockResolvedValue({ data: true, error: null })
    supabase = { auth: { getUser }, rpc } as unknown as SupabaseClient
  })

  it('no expulsa a un usuario de consola con la sesión vigente', async () => {
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('pregunta por el rol con is_console_user', async () => {
    await verificarSesionDeConsola(supabase)
    expect(rpc).toHaveBeenCalledWith('is_console_user')
  })

  it('devuelve sin_acceso si la base dice que no es de consola', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await verificarSesionDeConsola(supabase)).toBe('sin_acceso')
  })

  it('no expulsa si la consulta del rol falla', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('no expulsa si la consulta del rol tira', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('devuelve sesion_terminada si Auth ya no reconoce la sesión', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403, code: 'session_not_found' },
    })
    expect(await verificarSesionDeConsola(supabase)).toBe('sesion_terminada')
  })

  it('devuelve sesion_terminada si el token es rechazado con 401', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401, code: 'bad_jwt' },
    })
    expect(await verificarSesionDeConsola(supabase)).toBe('sesion_terminada')
  })

  it('devuelve sesion_terminada si el navegador ya no tiene sesión', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', status: 400 },
    })
    expect(await verificarSesionDeConsola(supabase)).toBe('sesion_terminada')
  })

  it('devuelve cuenta_desactivada si Auth dice que el usuario está baneado', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403, code: 'user_banned' },
    })
    expect(await verificarSesionDeConsola(supabase)).toBe('cuenta_desactivada')
  })

  it('no pregunta por el rol si la sesión ya no vale', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403, code: 'session_not_found' },
    })
    await verificarSesionDeConsola(supabase)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('no expulsa por un error de red al consultar la sesión', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', status: 0 },
    })
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('no expulsa por un 500 de Auth', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', status: 500 },
    })
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('no expulsa por un error de Auth sin status', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthUnknownError' },
    })
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('no expulsa si la consulta de la sesión tira', async () => {
    getUser.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })

  it('no expulsa si Auth no devuelve ni usuario ni error', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await verificarSesionDeConsola(supabase)).toBeNull()
  })
})
