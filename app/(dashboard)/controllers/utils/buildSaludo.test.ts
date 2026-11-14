import { buildSaludo } from './buildSaludo'

describe('buildSaludo', () => {
  it('greets with "Buenos días" in the morning', () => {
    expect(buildSaludo('Sofía', new Date(2026, 5, 15, 9, 0, 0))).toBe(
      'Buenos días, Sofía',
    )
  })

  it('greets with "Buenas tardes" in the afternoon', () => {
    expect(buildSaludo('Sofía', new Date(2026, 5, 15, 15, 0, 0))).toBe(
      'Buenas tardes, Sofía',
    )
  })

  it('greets with "Buenas noches" at night', () => {
    expect(buildSaludo('Sofía', new Date(2026, 5, 15, 21, 0, 0))).toBe(
      'Buenas noches, Sofía',
    )
  })

  it('switches to "Buenas tardes" at exactly noon', () => {
    expect(buildSaludo('Sofía', new Date(2026, 5, 15, 12, 0, 0))).toBe(
      'Buenas tardes, Sofía',
    )
  })

  it('switches to "Buenas noches" at exactly 20:00', () => {
    expect(buildSaludo('Sofía', new Date(2026, 5, 15, 20, 0, 0))).toBe(
      'Buenas noches, Sofía',
    )
  })

  it('omits the name when there is none', () => {
    expect(buildSaludo(null, new Date(2026, 5, 15, 9, 0, 0))).toBe(
      'Buenos días',
    )
  })
})
