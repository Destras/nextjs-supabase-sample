import { normalizarTelefonoAr, sinPrefijoAr } from './telefonoAr'

describe('normalizarTelefonoAr', () => {
  it('normalizes a celular number that includes the leading 9', () => {
    expect(normalizarTelefonoAr('+5491155550070')).toBe('+541155550070')
  })

  it('normalizes a number already without the leading 9', () => {
    expect(normalizarTelefonoAr('+541155550070')).toBe('+541155550070')
  })

  it('drops a leading 0 left after the country code', () => {
    expect(normalizarTelefonoAr('+5401155550070')).toBe('+541155550070')
  })

  it('ignores spaces and dashes in the input', () => {
    expect(normalizarTelefonoAr('+54 9 11-5555-0070')).toBe('+541155550070')
  })

  it('accepts an area code plus number with no country code at all', () => {
    expect(normalizarTelefonoAr('11 5555 1234')).toBe('+541155551234')
  })

  it('accepts a Buenos Aires number with no country code', () => {
    expect(normalizarTelefonoAr('11 5555-1234')).toBe('+541155551234')
  })

  it('drops a leading 0 on a number with no country code', () => {
    expect(normalizarTelefonoAr('011 5555 1234')).toBe('+541155551234')
  })

  it('rejects a local dialing format with the 15 celular prefix and no country code', () => {
    expect(normalizarTelefonoAr('011-15-55550070')).toBeNull()
  })

  it('rejects a number that is too short after normalization', () => {
    expect(normalizarTelefonoAr('+549115555')).toBeNull()
  })

  it('rejects a number from another country code', () => {
    expect(normalizarTelefonoAr('+59899123456')).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(normalizarTelefonoAr('')).toBeNull()
  })

  it('rejects a number whose area code would start with 9 after stripping', () => {
    expect(normalizarTelefonoAr('+5499415550070')).toBeNull()
  })
})

describe('sinPrefijoAr', () => {
  it('strips the country code from a canonical number so the field can show it next to the fixed +54', () => {
    expect(sinPrefijoAr('+541150000001')).toBe('1150000001')
  })

  it('leaves a value that has no country code untouched', () => {
    expect(sinPrefijoAr('1150000001')).toBe('1150000001')
  })

  it('leaves a non-canonical value untouched so the therapist sees what is actually stored', () => {
    expect(sinPrefijoAr('+54 9 11 5555 0070')).toBe('+54 9 11 5555 0070')
  })

  it('returns an empty string for an empty value', () => {
    expect(sinPrefijoAr('')).toBe('')
  })
})
