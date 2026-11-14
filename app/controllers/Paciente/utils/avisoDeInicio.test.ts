import { avisoDeInicio } from './avisoDeInicio'

describe('avisoDeInicio', () => {
  it('returns bienvenida when the paciente has no account and no previous welcome', () => {
    expect(
      avisoDeInicio({ tieneCuenta: false, bienvenidaRecibida: false }),
    ).toBe('bienvenida')
  })

  it('returns con_app when the paciente already has an account', () => {
    expect(
      avisoDeInicio({ tieneCuenta: true, bienvenidaRecibida: false }),
    ).toBe('con_app')
  })

  it('returns ya_recibida when the welcome was already delivered', () => {
    expect(
      avisoDeInicio({ tieneCuenta: false, bienvenidaRecibida: true }),
    ).toBe('ya_recibida')
  })

  it('gives ya_recibida precedence over con_app', () => {
    expect(avisoDeInicio({ tieneCuenta: true, bienvenidaRecibida: true })).toBe(
      'ya_recibida',
    )
  })
})
