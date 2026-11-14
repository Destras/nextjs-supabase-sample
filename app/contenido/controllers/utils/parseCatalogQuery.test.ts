import { parseCatalogQuery } from './parseCatalogQuery'

describe('parseCatalogQuery', () => {
  it('trims the surrounding whitespace of a decoded param', () => {
    expect(
      parseCatalogQuery(new URLSearchParams('q=%20medit%20').get('q')),
    ).toBe('medit')
  })

  it('returns an empty string when the param is absent', () => {
    expect(parseCatalogQuery(null)).toBe('')
  })

  it('returns an empty string when the param is empty', () => {
    expect(parseCatalogQuery('')).toBe('')
  })

  it('returns an empty string when the param is whitespace only', () => {
    expect(parseCatalogQuery('   ')).toBe('')
  })
})
