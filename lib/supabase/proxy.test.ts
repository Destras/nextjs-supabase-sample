/**
 * @jest-environment node
 */
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { updateSession } from './proxy'

jest.mock('@supabase/ssr')
jest.mock('../utils', () => ({ hasEnvVars: true }))

const ORIGEN = 'http://panel.test'
const COOKIE_DE_SESION = 'sb-panel-auth-token'

describe('updateSession', () => {
  let getClaims: jest.Mock
  let signOut: jest.Mock
  let rpc: jest.Mock
  let pedir: (ruta: string) => NextRequest
  let numeroDeSesion = 0

  beforeEach(() => {
    // Una sesión distinta por test: el proxy recuerda por un rato las sesiones
    // de consola, y esa memoria vive en el módulo.
    numeroDeSesion += 1
    getClaims = jest.fn().mockResolvedValue({
      data: {
        claims: { sub: 'user-1', session_id: `sesion-${numeroDeSesion}` },
      },
    })
    signOut = jest.fn().mockResolvedValue({ error: null })
    rpc = jest.fn().mockResolvedValue({ data: true, error: null })
    ;(createServerClient as jest.Mock).mockReturnValue({
      auth: { getClaims, signOut },
      rpc,
    })
    pedir = (ruta: string) =>
      new NextRequest(`${ORIGEN}${ruta}`, {
        headers: { cookie: `${COOKIE_DE_SESION}=abc; theme=dark` },
      })
  })

  it('manda al login, sin mensaje, a quien no tiene sesión', async () => {
    getClaims.mockResolvedValue({ data: null })
    const response = await updateSession(pedir('/pacientes?error=sin_acceso'))
    expect(response.headers.get('location')).toBe(`${ORIGEN}/auth/login`)
  })

  it('no consulta el rol si no hay sesión', async () => {
    getClaims.mockResolvedValue({ data: null })
    await updateSession(pedir('/pacientes'))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('deja pasar a un usuario de consola', async () => {
    const response = await updateSession(pedir('/pacientes'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('consulta el rol con is_console_user', async () => {
    await updateSession(pedir('/pacientes'))
    expect(rpc).toHaveBeenCalledWith('is_console_user')
  })

  it('devuelve al login con el motivo a quien no es de consola', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const response = await updateSession(pedir('/pacientes?x=1'))
    expect(response.headers.get('location')).toBe(
      `${ORIGEN}/auth/login?error=sin_acceso`,
    )
  })

  it('cierra solo esta sesión, no las de otros dispositivos', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await updateSession(pedir('/pacientes'))
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('borra la cookie de sesión al expulsar aunque el signOut falle', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    signOut.mockRejectedValue(new Error('red caída'))
    const response = await updateSession(pedir('/pacientes'))
    expect(response.cookies.get(COOKIE_DE_SESION)).toEqual(
      expect.objectContaining({ value: '', maxAge: 0 }),
    )
  })

  it('no toca las cookies que no son de sesión al expulsar', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const response = await updateSession(pedir('/pacientes'))
    expect(response.cookies.get('theme')).toBeUndefined()
  })

  it('deja pasar si la consulta del rol devuelve un error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const response = await updateSession(pedir('/pacientes'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('deja pasar si la consulta del rol revienta', async () => {
    rpc.mockRejectedValue(new Error('fetch failed'))
    const response = await updateSession(pedir('/pacientes'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('no cierra la sesión si la consulta del rol falla', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    await updateSession(pedir('/pacientes'))
    expect(signOut).not.toHaveBeenCalled()
  })

  it('no consulta el rol en el login', async () => {
    await updateSession(pedir('/auth/login'))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('expulsa a un paciente que llega a elegir contraseña', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    const response = await updateSession(pedir('/auth/update-password'))
    expect(response.headers.get('location')).toBe(
      `${ORIGEN}/auth/login?error=sin_acceso`,
    )
  })

  it('no vuelve a consultar el rol de una sesión de consola recién verificada', async () => {
    await updateSession(pedir('/pacientes'))
    await updateSession(pedir('/alertas'))
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('consulta siempre a quien no es de consola', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await updateSession(pedir('/pacientes'))
    await updateSession(pedir('/alertas'))
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('vuelve a consultar si la consulta anterior falló', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    await updateSession(pedir('/pacientes'))
    await updateSession(pedir('/alertas'))
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
