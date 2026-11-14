import { semanasDeTratamiento } from './semanasDeTratamiento'

describe('semanasDeTratamiento', () => {
  it('returns cantidad_niveles * 4 (4 niveles → 16 semanas)', () => {
    expect(semanasDeTratamiento(4)).toBe(16)
  })

  it('scales with cantidad_niveles (2 niveles → 8 semanas)', () => {
    expect(semanasDeTratamiento(2)).toBe(8)
  })

  it('returns null when cantidad_niveles is null (incomplete data)', () => {
    expect(semanasDeTratamiento(null)).toBeNull()
  })

  it('returns 0 when cantidad_niveles is 0 (not treated as falsy → null)', () => {
    expect(semanasDeTratamiento(0)).toBe(0)
  })
})
