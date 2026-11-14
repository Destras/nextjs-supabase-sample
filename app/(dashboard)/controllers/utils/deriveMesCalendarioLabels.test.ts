import { deriveMesCalendarioLabels } from './deriveMesCalendarioLabels'

describe('deriveMesCalendarioLabels', () => {
  it('returns the capitalized current and next month names', () => {
    // 2026-07-06 → julio (actual) / agosto (siguiente)
    expect(deriveMesCalendarioLabels(new Date(2026, 6, 6))).toEqual({
      actual: 'Julio',
      siguiente: 'Agosto',
    })
  })

  it('rolls over from december to january', () => {
    expect(deriveMesCalendarioLabels(new Date(2026, 11, 15))).toEqual({
      actual: 'Diciembre',
      siguiente: 'Enero',
    })
  })

  it('handles january to february', () => {
    expect(deriveMesCalendarioLabels(new Date(2026, 0, 1))).toEqual({
      actual: 'Enero',
      siguiente: 'Febrero',
    })
  })
})
