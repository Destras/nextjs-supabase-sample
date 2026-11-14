import { normalizeForSearch } from './normalizeForSearch'

describe('normalizeForSearch', () => {
  it('is case-insensitive (folds to lowercase)', () => {
    expect(normalizeForSearch('MEDITACION')).toBe('meditacion')
  })

  it('strips accents so "meditación" matches "meditacion"', () => {
    expect(normalizeForSearch('Meditación')).toBe('meditacion')
  })

  it('makes accented and unaccented queries converge', () => {
    expect(normalizeForSearch('ánimo')).toBe(normalizeForSearch('animo'))
  })

  it('collapses ñ to n (NFD decomposes ñ into n + combining tilde)', () => {
    expect(normalizeForSearch('niño')).toBe('nino')
  })

  it('returns empty string unchanged', () => {
    expect(normalizeForSearch('')).toBe('')
  })

  it('is idempotent', () => {
    const once = normalizeForSearch('Canción de Cuna ÀÉÎ')
    expect(normalizeForSearch(once)).toBe(once)
  })
})
