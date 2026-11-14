import { monthsBetween } from './monthsBetween'

// Mediodía UTC para que el día calendario coincida en UTC y en local (UTC-3).
describe('monthsBetween', () => {
  it('returns 0 when desde and hasta are the same day', () => {
    expect(monthsBetween('2026-06-01', new Date('2026-06-01T12:00:00Z'))).toBe(
      0,
    )
  })

  it('counts a full calendar month once the day-of-month is reached', () => {
    expect(monthsBetween('2026-05-01', new Date('2026-06-01T12:00:00Z'))).toBe(
      1,
    )
  })

  it('does NOT count the partial month when hasta day < desde day', () => {
    // 20-may → 15-jun: el día 20 todavía no se alcanzó en junio → 0 meses completos
    expect(monthsBetween('2026-05-20', new Date('2026-06-15T12:00:00Z'))).toBe(
      0,
    )
  })

  it('counts the month when hasta day >= desde day', () => {
    expect(monthsBetween('2026-05-15', new Date('2026-06-20T12:00:00Z'))).toBe(
      1,
    )
  })

  it('counts multiple complete months in the same year', () => {
    expect(monthsBetween('2026-01-01', new Date('2026-06-01T12:00:00Z'))).toBe(
      5,
    )
  })

  it('counts complete months across a year boundary', () => {
    expect(monthsBetween('2024-06-01', new Date('2026-06-01T12:00:00Z'))).toBe(
      24,
    )
  })

  it('handles month-end starts where the target month is shorter', () => {
    // 31-ene → 01-mar: el día 31 no existe en febrero (hD=1 < dD=31) → 1 mes
    expect(monthsBetween('2026-01-31', new Date('2026-03-01T12:00:00Z'))).toBe(
      1,
    )
  })

  it('clamps to 0 when desde is in the future (never negative)', () => {
    expect(monthsBetween('2027-01-01', new Date('2026-06-01T12:00:00Z'))).toBe(
      0,
    )
  })

  it('uses the LOCAL calendar (UTC-3), not UTC, near a month boundary', () => {
    // 31-may 23:30 LOCAL (UTC-3) = 1-jun 02:30 UTC. Localmente sigue siendo mayo,
    // así que contra un inicio el 01-jun da 0 (leer por UTC daría junio → 1).
    expect(monthsBetween('2026-06-01', new Date(2026, 4, 31, 23, 30, 0))).toBe(
      0,
    )
  })
})
