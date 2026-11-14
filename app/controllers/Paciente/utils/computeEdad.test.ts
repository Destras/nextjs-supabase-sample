import { computeEdad } from './computeEdad'

describe('computeEdad', () => {
  it('returns null when fechaNacimiento is null', () => {
    expect(computeEdad(null, new Date('2026-05-28T12:00:00Z'))).toBeNull()
  })

  it('returns the age when birthday has already passed this year', () => {
    expect(computeEdad('1990-01-15', new Date('2026-05-28T12:00:00Z'))).toBe(36)
  })

  it('returns age - 1 when birthday has not yet happened this year', () => {
    expect(computeEdad('1990-12-25', new Date('2026-05-28T12:00:00Z'))).toBe(35)
  })

  it('returns the age on the exact birthday', () => {
    expect(computeEdad('1990-05-28', new Date('2026-05-28T12:00:00Z'))).toBe(36)
  })

  it('returns 0 for a newborn (today)', () => {
    expect(computeEdad('2026-05-28', new Date('2026-05-28T12:00:00Z'))).toBe(0)
  })

  it('handles end-of-year boundary (Dec 31 birth, Jan 1 today)', () => {
    expect(computeEdad('1990-12-31', new Date('2026-01-01T12:00:00Z'))).toBe(35)
  })

  it('defaults today to now when not provided', () => {
    const result = computeEdad('1990-01-01')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  it('uses the LOCAL calendar day, not UTC, near a birthday boundary', () => {
    // 31-may 23:30 LOCAL (UTC-3) = 1-jun 02:30 UTC. Cumple el 01-jun: localmente
    // todavía no cumplió → 35 (un cálculo por UTC daría 36 un día antes).
    expect(computeEdad('1990-06-01', new Date(2026, 4, 31, 23, 30, 0))).toBe(35)
  })
})
