import type { CatalogItem, TabKey } from '../catalogItem'
import { countCatalogByTab } from './countCatalogByTab'

const buildItem = (id: string, tab: TabKey, nombre: string): CatalogItem => ({
  id,
  source: 'contenido',
  tab,
  nombre,
  descripcion: null,
  isPlayable: false,
  duracionSeg: null,
})

describe('countCatalogByTab', () => {
  let items: ReadonlyArray<CatalogItem>

  beforeEach(() => {
    items = [
      buildItem('v-1', 'videos', 'Meditación guiada'),
      buildItem('v-2', 'videos', 'Respiración'),
      buildItem('m-1', 'mantras', 'Mantra de meditación'),
      buildItem('e-1', 'egregores', 'Egregor solar'),
      buildItem('c-1', 'cma', 'Meditacion CMA'),
      buildItem('c-2', 'cma', 'Otra pieza'),
    ]
  })

  it('counts, per tab, the items matching the query', () => {
    expect(countCatalogByTab(items, 'medit')).toEqual({
      videos: 1,
      mantras: 1,
      egregores: 0,
      cma: 1,
      ic: 0,
    })
  })

  it('returns the tab totals for an empty query', () => {
    expect(countCatalogByTab(items, '')).toEqual({
      videos: 2,
      mantras: 1,
      egregores: 1,
      cma: 2,
      ic: 0,
    })
  })

  it('returns the tab totals for a whitespace-only query', () => {
    expect(countCatalogByTab(items, '   ')).toEqual({
      videos: 2,
      mantras: 1,
      egregores: 1,
      cma: 2,
      ic: 0,
    })
  })

  it('reports 0 for every tab when there are no items', () => {
    expect(countCatalogByTab([], 'medit')).toEqual({
      videos: 0,
      mantras: 0,
      egregores: 0,
      cma: 0,
      ic: 0,
    })
  })
})
