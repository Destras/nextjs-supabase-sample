import { buildCatalogTabHref } from './buildCatalogTabHref'
import { parseCatalogQuery } from './parseCatalogQuery'

describe('buildCatalogTabHref', () => {
  it('carries q and vista together', () => {
    expect(
      buildCatalogTabHref('mantras', { query: 'medit', viewMode: 'tabla' }),
    ).toBe('/contenido/mantras?q=medit&vista=tabla')
  })

  it('carries only q in cards view', () => {
    expect(
      buildCatalogTabHref('mantras', { query: 'medit', viewMode: 'cards' }),
    ).toBe('/contenido/mantras?q=medit')
  })

  it('carries only vista when the query is empty', () => {
    expect(
      buildCatalogTabHref('mantras', { query: '', viewMode: 'tabla' }),
    ).toBe('/contenido/mantras?vista=tabla')
  })

  it('returns the bare tab path with neither param', () => {
    expect(
      buildCatalogTabHref('mantras', { query: '', viewMode: 'cards' }),
    ).toBe('/contenido/mantras')
  })

  it('returns the bare tab path for a whitespace-only query', () => {
    expect(
      buildCatalogTabHref('mantras', { query: '   ', viewMode: 'cards' }),
    ).toBe('/contenido/mantras')
  })

  it('encodes q so that it round-trips', () => {
    const href = buildCatalogTabHref('mantras', {
      query: 'paz & luz',
      viewMode: 'cards',
    })
    expect(
      parseCatalogQuery(new URL(href, 'http://x').searchParams.get('q')),
    ).toBe('paz & luz')
  })

  it('builds the videos path', () => {
    expect(
      buildCatalogTabHref('videos', { query: '', viewMode: 'cards' }),
    ).toBe('/contenido/videos')
  })

  it('builds the egregores path', () => {
    expect(
      buildCatalogTabHref('egregores', { query: '', viewMode: 'cards' }),
    ).toBe('/contenido/egregores')
  })

  it('builds the cma path', () => {
    expect(buildCatalogTabHref('cma', { query: '', viewMode: 'cards' })).toBe(
      '/contenido/cma',
    )
  })

  it('builds the ic path', () => {
    expect(buildCatalogTabHref('ic', { query: '', viewMode: 'cards' })).toBe(
      '/contenido/ic',
    )
  })
})
