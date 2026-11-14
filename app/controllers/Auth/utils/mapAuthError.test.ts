import { mapAuthError } from './mapAuthError'

describe('mapAuthError', () => {
  let err: { code?: string; name?: string; message: string }

  beforeEach(() => {
    err = { code: 'invalid_credentials', message: 'Invalid login credentials' }
  })

  it('maps "invalid_credentials" to the wrong email or password message', () => {
    expect(mapAuthError(err)).toEqual(
      'El correo o la contraseña no son correctos.',
    )
  })

  it.each([
    ['user_banned', 'Tu cuenta está desactivada. Hablá con el administrador.'],
    ['email_not_confirmed', 'Todavía no confirmaste tu correo.'],
    ['weak_password', 'La contraseña tiene que tener al menos 8 caracteres.'],
    [
      'same_password',
      'La contraseña nueva tiene que ser distinta de la anterior.',
    ],
    [
      'over_email_send_rate_limit',
      'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.',
    ],
    [
      'over_request_rate_limit',
      'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.',
    ],
    ['email_address_invalid', 'Revisá el correo: no parece válido.'],
    ['validation_failed', 'Revisá el correo: no parece válido.'],
    ['otp_expired', 'El enlace venció o ya se usó. Pedí uno nuevo.'],
    ['session_not_found', 'El enlace venció o ya se usó. Pedí uno nuevo.'],
    ['session_expired', 'El enlace venció o ya se usó. Pedí uno nuevo.'],
    [
      'request_timeout',
      'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    ],
  ])('maps the code "%s" to its message in Spanish', (code, expected) => {
    err.code = code
    expect(mapAuthError(err)).toEqual(expected)
  })

  it('falls back to the error name when the error has no code and the session is missing', () => {
    err = { name: 'AuthSessionMissingError', message: 'Auth session missing!' }
    expect(mapAuthError(err)).toEqual(
      'El enlace venció o ya se usó. Pedí uno nuevo.',
    )
  })

  it('falls back to the error name when the error has no code and the request never reached the server', () => {
    err = { name: 'AuthRetryableFetchError', message: 'Failed to fetch' }
    expect(mapAuthError(err)).toEqual(
      'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    )
  })

  it('prefers the code over the name when both are known', () => {
    err = {
      code: 'same_password',
      name: 'AuthRetryableFetchError',
      message: 'whatever',
    }
    expect(mapAuthError(err)).toEqual(
      'La contraseña nueva tiene que ser distinta de la anterior.',
    )
  })

  it('uses the name when the code is unknown but the name is known', () => {
    err = {
      code: 'made_up_code',
      name: 'AuthSessionMissingError',
      message: 'whatever',
    }
    expect(mapAuthError(err)).toEqual(
      'El enlace venció o ya se usó. Pedí uno nuevo.',
    )
  })

  it('returns the generic message for an unknown code', () => {
    err.code = 'made_up_code'
    expect(mapAuthError(err)).toEqual('Algo salió mal. Probá de nuevo.')
  })

  it('returns the generic message for a code that only exists on Object.prototype', () => {
    err.code = 'constructor'
    expect(mapAuthError(err)).toEqual('Algo salió mal. Probá de nuevo.')
  })

  it('returns the generic message when the code is not a string', () => {
    expect(mapAuthError({ code: 42 })).toEqual(
      'Algo salió mal. Probá de nuevo.',
    )
  })

  it('returns the generic message for a plain Error without code', () => {
    expect(mapAuthError(new Error('Invalid login credentials'))).toEqual(
      'Algo salió mal. Probá de nuevo.',
    )
  })

  it('returns the generic message when the thrown value is a string', () => {
    expect(mapAuthError('network failure')).toEqual(
      'Algo salió mal. Probá de nuevo.',
    )
  })

  it('returns the generic message when the thrown value is null', () => {
    expect(mapAuthError(null)).toEqual('Algo salió mal. Probá de nuevo.')
  })

  it('returns the generic message when the thrown value is undefined', () => {
    expect(mapAuthError(undefined)).toEqual('Algo salió mal. Probá de nuevo.')
  })
})
