import { mapLoginUrlError } from './mapLoginUrlError'

describe('mapLoginUrlError', () => {
  it('explica que la cuenta no tiene acceso al panel', () => {
    expect(mapLoginUrlError('sin_acceso')).toBe(
      'Esta cuenta no tiene acceso al panel. Si sos paciente, usá la app.',
    )
  })

  it('explica que la sesión terminó', () => {
    expect(mapLoginUrlError('sesion_terminada')).toBe(
      'Tu sesión terminó. Volvé a entrar; si no podés, hablá con el administrador.',
    )
  })

  it('explica que la cuenta está desactivada', () => {
    expect(mapLoginUrlError('cuenta_desactivada')).toBe(
      'Tu cuenta está desactivada. Hablá con el administrador.',
    )
  })

  it('no muestra nada si la URL no trae el parámetro', () => {
    expect(mapLoginUrlError(null)).toBeNull()
  })

  it('no refleja un texto arbitrario de la URL', () => {
    expect(mapLoginUrlError('cualquier_cosa<script>')).toBeNull()
  })

  it('no devuelve propiedades heredadas de Object', () => {
    expect(mapLoginUrlError('constructor')).toBeNull()
  })
})
