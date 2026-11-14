import { semanaActual } from './semanaActual'

describe('semanaActual', () => {
  it('returns 1 on the start day (la semana 1 empieza el día del arranque)', () => {
    expect(semanaActual('2026-06-01', new Date(2026, 5, 1, 12, 0, 0))).toEqual(
      1,
    )
  })

  it('returns 1 on day 6 (último día de la semana 1)', () => {
    expect(semanaActual('2026-06-01', new Date(2026, 5, 7, 12, 0, 0))).toEqual(
      1,
    )
  })

  it('returns 2 on day 7', () => {
    expect(semanaActual('2026-06-01', new Date(2026, 5, 8, 12, 0, 0))).toEqual(
      2,
    )
  })

  it('returns 5 on day 28 (arranca el segundo mes de tratamiento)', () => {
    // 2026-06-01 + 28 días = 2026-06-29
    expect(semanaActual('2026-06-01', new Date(2026, 5, 29, 12, 0, 0))).toEqual(
      5,
    )
  })

  it('counts LOCAL calendar days, not UTC, late at night', () => {
    // 7-jun 23:30 LOCAL (UTC-3) = 8-jun 02:30 UTC. Localmente es el día 6 →
    // semana 1 (un cálculo por UTC daría día 7 → semana 2).
    expect(semanaActual('2026-06-01', new Date(2026, 5, 7, 23, 30, 0))).toEqual(
      1,
    )
  })

  it('does not jump a week early in the morning of day 6 (no depende de la hora)', () => {
    expect(semanaActual('2026-06-01', new Date(2026, 5, 7, 0, 5, 0))).toEqual(1)
  })

  it('returns 0 or less when fechaInicio is in the future', () => {
    // 30 días antes del arranque → floor(-30/7)+1 = -4
    expect(semanaActual('2026-07-01', new Date(2026, 5, 1, 12, 0, 0))).toEqual(
      -4,
    )
  })
})
