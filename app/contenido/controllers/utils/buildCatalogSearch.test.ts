import { buildCatalogSearch } from './buildCatalogSearch'
import { parseCatalogQuery } from './parseCatalogQuery'

describe('buildCatalogSearch', () => {
  it('sets q', () => {
    expect(buildCatalogSearch('', { q: 'medit' })).toBe('?q=medit')
  })

  it('removes q when the value is empty', () => {
    expect(buildCatalogSearch('?q=medit', { q: '' })).toBe('')
  })

  it('removes q when the value is whitespace only', () => {
    expect(buildCatalogSearch('?q=medit', { q: '   ' })).toBe('')
  })

  it('sets vista when it is tabla', () => {
    expect(buildCatalogSearch('', { vista: 'tabla' })).toBe('?vista=tabla')
  })

  it('removes vista when it is cards', () => {
    expect(buildCatalogSearch('?vista=tabla', { vista: 'cards' })).toBe('')
  })

  it('preserves vista when only q is patched', () => {
    expect(buildCatalogSearch('?vista=tabla', { q: 'medit' })).toBe(
      '?vista=tabla&q=medit',
    )
  })

  it('preserves q when only vista is patched', () => {
    expect(buildCatalogSearch('?q=medit', { vista: 'tabla' })).toBe(
      '?q=medit&vista=tabla',
    )
  })

  it('preserves unrelated params', () => {
    expect(buildCatalogSearch('?tipo=videos', { q: 'medit' })).toBe(
      '?tipo=videos&q=medit',
    )
  })

  it('accepts a current search without the leading question mark', () => {
    expect(buildCatalogSearch('tipo=videos', { q: 'medit' })).toBe(
      '?tipo=videos&q=medit',
    )
  })

  it('returns an empty string when nothing remains', () => {
    expect(
      buildCatalogSearch('?q=medit&vista=tabla', { q: '', vista: 'cards' }),
    ).toBe('')
  })

  it('keeps the remaining params when only some are removed', () => {
    expect(buildCatalogSearch('?tipo=videos&q=medit', { q: '' })).toBe(
      '?tipo=videos',
    )
  })

  it('trims the written q', () => {
    expect(buildCatalogSearch('', { q: '  medit  ' })).toBe('?q=medit')
  })

  it('encodes q so that it round-trips', () => {
    const search = buildCatalogSearch('', { q: 'paz & luz' })
    expect(parseCatalogQuery(new URLSearchParams(search).get('q'))).toBe(
      'paz & luz',
    )
  })

  it('round-trips a q containing + ? # and %', () => {
    const search = buildCatalogSearch('', { q: 'a+b?c#d%e' })
    expect(parseCatalogQuery(new URLSearchParams(search).get('q'))).toBe(
      'a+b?c#d%e',
    )
  })
})
