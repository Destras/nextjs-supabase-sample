import { EtapaStatus } from '../TratamientoTypes'
import { isEtapaCerrada } from './isEtapaCerrada'

describe('isEtapaCerrada', () => {
  let status: EtapaStatus

  beforeEach(() => {
    status = EtapaStatus.EN_CURSO
  })

  it('returns true for FINALIZADA', () => {
    status = EtapaStatus.FINALIZADA
    expect(isEtapaCerrada(status)).toBe(true)
  })

  it('returns true for ABANDONADA', () => {
    status = EtapaStatus.ABANDONADA
    expect(isEtapaCerrada(status)).toBe(true)
  })

  it('returns false for EN_CURSO', () => {
    status = EtapaStatus.EN_CURSO
    expect(isEtapaCerrada(status)).toBe(false)
  })

  it('returns false for PENDIENTE', () => {
    status = EtapaStatus.PENDIENTE
    expect(isEtapaCerrada(status)).toBe(false)
  })
})
