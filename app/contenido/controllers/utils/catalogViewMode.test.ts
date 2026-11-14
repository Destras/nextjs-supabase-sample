import { isCatalogViewMode, parseCatalogViewMode } from './catalogViewMode'

describe('parseCatalogViewMode', () => {
  it('returns tabla for the exact value tabla', () => {
    expect(parseCatalogViewMode('tabla')).toBe('tabla')
  })

  it('returns cards when the param is absent', () => {
    expect(parseCatalogViewMode(null)).toBe('cards')
  })

  it('returns cards for the value cards', () => {
    expect(parseCatalogViewMode('cards')).toBe('cards')
  })

  it('returns cards for an unknown value', () => {
    expect(parseCatalogViewMode('foo')).toBe('cards')
  })

  it('returns cards for a different casing of tabla', () => {
    expect(parseCatalogViewMode('TABLA')).toBe('cards')
  })
})

describe('isCatalogViewMode', () => {
  it('accepts cards', () => {
    expect(isCatalogViewMode('cards')).toBe(true)
  })

  it('accepts tabla', () => {
    expect(isCatalogViewMode('tabla')).toBe(true)
  })

  it('rejects the empty string emitted when the active option is deselected', () => {
    expect(isCatalogViewMode('')).toBe(false)
  })

  it('rejects an unknown value', () => {
    expect(isCatalogViewMode('x')).toBe(false)
  })
})
