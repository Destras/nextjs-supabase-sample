import {
  ACCESO,
  cookiesDeSesion,
  decidirAccesoAlPanel,
  requiereSerConsola,
} from './accesoAlPanel'

describe('requiereSerConsola', () => {
  it('exige ser de consola en una ruta del panel', () => {
    expect(requiereSerConsola('/pacientes')).toBe(true)
  })

  it('exige ser de consola en el Dashboard', () => {
    expect(requiereSerConsola('/')).toBe(true)
  })

  it('no lo exige en el login', () => {
    expect(requiereSerConsola('/auth/login')).toBe(false)
  })

  it('no lo exige al pedir la recuperación de la contraseña', () => {
    expect(requiereSerConsola('/auth/forgot-password')).toBe(false)
  })

  it('no lo exige al verificar el link del mail', () => {
    expect(requiereSerConsola('/auth/confirm')).toBe(false)
  })

  it('lo exige para elegir la contraseña desde el panel', () => {
    expect(requiereSerConsola('/auth/update-password')).toBe(true)
  })

  it('no confunde una ruta del panel que empieza parecido a /auth', () => {
    expect(requiereSerConsola('/authors')).toBe(true)
  })
})

describe('decidirAccesoAlPanel', () => {
  it('manda al login a quien pide una ruta del panel sin sesión', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/pacientes',
        haySesion: false,
        esConsola: null,
      }),
    ).toBe(ACCESO.IR_A_LOGIN)
  })

  it('deja pasar a un usuario de consola', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/pacientes',
        haySesion: true,
        esConsola: true,
      }),
    ).toBe(ACCESO.PASAR)
  })

  it('expulsa a quien tiene sesión y no es de consola', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/pacientes',
        haySesion: true,
        esConsola: false,
      }),
    ).toBe(ACCESO.EXPULSAR)
  })

  it('deja pasar si no se pudo consultar el rol', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/pacientes',
        haySesion: true,
        esConsola: null,
      }),
    ).toBe(ACCESO.PASAR)
  })

  it('deja ver el login sin sesión', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/auth/login',
        haySesion: false,
        esConsola: null,
      }),
    ).toBe(ACCESO.PASAR)
  })

  it('no expulsa en el login aunque la sesión no sea de consola', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/auth/login',
        haySesion: true,
        esConsola: false,
      }),
    ).toBe(ACCESO.PASAR)
  })

  it('expulsa a un paciente que llega a elegir contraseña', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/auth/update-password',
        haySesion: true,
        esConsola: false,
      }),
    ).toBe(ACCESO.EXPULSAR)
  })

  it('deja ver la pantalla de elegir contraseña sin sesión', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/auth/update-password',
        haySesion: false,
        esConsola: null,
      }),
    ).toBe(ACCESO.PASAR)
  })

  it('deja elegir contraseña a un terapeuta', () => {
    expect(
      decidirAccesoAlPanel({
        pathname: '/auth/update-password',
        haySesion: true,
        esConsola: true,
      }),
    ).toBe(ACCESO.PASAR)
  })
})

describe('cookiesDeSesion', () => {
  it('devuelve las cookies de sesión de Supabase, incluidas las partidas', () => {
    expect(
      cookiesDeSesion([
        'sb-wt1-auth-token',
        'sb-wt1-auth-token.0',
        'sb-wt1-auth-token.1',
        'sb-wt1-auth-token-code-verifier',
        'theme',
        '__next_hmr_refresh_hash__',
      ]),
    ).toEqual([
      'sb-wt1-auth-token',
      'sb-wt1-auth-token.0',
      'sb-wt1-auth-token.1',
      'sb-wt1-auth-token-code-verifier',
    ])
  })

  it('no devuelve nada si no hay cookies de sesión', () => {
    expect(cookiesDeSesion(['theme'])).toEqual([])
  })
})
