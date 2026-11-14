import type { CatalogItem, TabKey } from '../catalogItem'
import { catalogItemHref } from './catalogItemHref'
import { parseCatalogQuery } from './parseCatalogQuery'

const buildItem = (id: string, tab: TabKey): CatalogItem => ({
  id,
  source: 'contenido',
  tab,
  nombre: 'Nombre',
  descripcion: null,
  isPlayable: false,
  duracionSeg: null,
})

describe('catalogItemHref', () => {
  let videoItem: CatalogItem

  beforeEach(() => {
    videoItem = buildItem('c-1', 'videos')
  })

  it('keeps the bare href for a videos item without filters', () => {
    expect(
      catalogItemHref(buildItem('c-1', 'videos'), {
        query: '',
        viewMode: 'cards',
      }),
    ).toBe('/contenido/c-1?tipo=videos')
  })

  it('keeps the bare href for a mantras item without filters', () => {
    expect(
      catalogItemHref(buildItem('c-2', 'mantras'), {
        query: '',
        viewMode: 'cards',
      }),
    ).toBe('/contenido/c-2?tipo=mantras')
  })

  it('keeps the bare href for an egregores item without filters', () => {
    expect(
      catalogItemHref(buildItem('c-3', 'egregores'), {
        query: '',
        viewMode: 'cards',
      }),
    ).toBe('/contenido/c-3?tipo=egregores')
  })

  it('keeps the bare href for a cma item without filters', () => {
    expect(
      catalogItemHref(buildItem('c-4', 'cma'), {
        query: '',
        viewMode: 'cards',
      }),
    ).toBe('/contenido/c-4?tipo=cma')
  })

  it('keeps the bare href for an ic item without filters', () => {
    expect(
      catalogItemHref(buildItem('c-5', 'ic'), {
        query: '',
        viewMode: 'cards',
      }),
    ).toBe('/contenido/c-5?tipo=ic')
  })

  it('keeps the bare href for a whitespace-only query in cards view', () => {
    expect(
      catalogItemHref(videoItem, { query: '   ', viewMode: 'cards' }),
    ).toBe('/contenido/c-1?tipo=videos')
  })

  it('carries q and vista after tipo', () => {
    expect(
      catalogItemHref(videoItem, { query: 'medit', viewMode: 'tabla' }),
    ).toBe('/contenido/c-1?tipo=videos&q=medit&vista=tabla')
  })

  it('carries only q', () => {
    expect(
      catalogItemHref(videoItem, { query: 'medit', viewMode: 'cards' }),
    ).toBe('/contenido/c-1?tipo=videos&q=medit')
  })

  it('carries only vista', () => {
    expect(catalogItemHref(videoItem, { query: '', viewMode: 'tabla' })).toBe(
      '/contenido/c-1?tipo=videos&vista=tabla',
    )
  })

  it('encodes q so that it round-trips', () => {
    const href = catalogItemHref(videoItem, {
      query: 'paz & luz',
      viewMode: 'cards',
    })
    expect(
      parseCatalogQuery(new URL(href, 'http://x').searchParams.get('q')),
    ).toBe('paz & luz')
  })

  it('keeps tipo readable when q is encoded', () => {
    const href = catalogItemHref(videoItem, {
      query: 'paz & luz',
      viewMode: 'cards',
    })
    expect(new URL(href, 'http://x').searchParams.get('tipo')).toBe('videos')
  })
})
