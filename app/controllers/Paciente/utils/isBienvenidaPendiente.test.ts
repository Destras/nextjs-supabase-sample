import { isBienvenidaPendiente } from './isBienvenidaPendiente'
import { PACIENTE_STATE } from '../PacienteTypes'

const base = {
  etapaActivaId: 'e-1',
  sinIniciar: false,
  tieneCuenta: false,
  state: PACIENTE_STATE.ACTIVE,
  bienvenidaRecibida: false,
}

describe('isBienvenidaPendiente', () => {
  it('is true when started, without account, not in baja and without bienvenida', () => {
    expect(isBienvenidaPendiente(base)).toEqual(true)
  })

  it('is false without an active etapa', () => {
    expect(isBienvenidaPendiente({ ...base, etapaActivaId: null })).toEqual(
      false,
    )
  })

  it('is false when the treatment has not started', () => {
    expect(isBienvenidaPendiente({ ...base, sinIniciar: true })).toEqual(false)
  })

  it('is false when the paciente already has an account', () => {
    expect(isBienvenidaPendiente({ ...base, tieneCuenta: true })).toEqual(false)
  })

  it('is false when the paciente is in baja', () => {
    expect(
      isBienvenidaPendiente({ ...base, state: PACIENTE_STATE.BAJA }),
    ).toEqual(false)
  })

  it('is false when the bienvenida was already received', () => {
    expect(
      isBienvenidaPendiente({ ...base, bienvenidaRecibida: true }),
    ).toEqual(false)
  })
})
