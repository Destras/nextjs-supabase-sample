import { filterCatalogByName } from './filterCatalogByName'

interface Named {
  readonly nombre: string
  readonly descripcion?: string
}

describe('filterCatalogByName', () => {
  let items: ReadonlyArray<Named>

  beforeEach(() => {
    items = [
      { nombre: 'Meditación guiada' },
      { nombre: 'Respiración' },
      { nombre: 'Guía de meditación' },
    ]
  })

  it('matches a substring ignoring case', () => {
    expect(filterCatalogByName(items, 'MEDIT')).toEqual([
      { nombre: 'Meditación guiada' },
      { nombre: 'Guía de meditación' },
    ])
  })

  it('matches an accented name with an unaccented query', () => {
    expect(filterCatalogByName(items, 'meditacion guiada')).toEqual([
      { nombre: 'Meditación guiada' },
    ])
  })

  it('matches an unaccented name with an accented query', () => {
    expect(
      filterCatalogByName([{ nombre: 'Meditacion' }], 'meditación'),
    ).toEqual([{ nombre: 'Meditacion' }])
  })

  it('matches a substring that is not a prefix', () => {
    expect(filterCatalogByName(items, 'de medit')).toEqual([
      { nombre: 'Guía de meditación' },
    ])
  })

  it('returns every item for an empty query', () => {
    expect(filterCatalogByName(items, '')).toEqual(items)
  })

  it('returns every item for a whitespace-only query', () => {
    expect(filterCatalogByName(items, '   ')).toEqual(items)
  })

  it('matches only the nombre field', () => {
    expect(
      filterCatalogByName(
        [{ nombre: 'Alfa', descripcion: 'sobre meditación' }],
        'medit',
      ),
    ).toEqual([])
  })

  it('ignores leading and trailing whitespace of a non-blank query', () => {
    expect(filterCatalogByName(items, '  respiracion  ')).toEqual([
      { nombre: 'Respiración' },
    ])
  })

  it('does not mutate the input array', () => {
    const snapshot = [...items]
    filterCatalogByName(items, 'medit')
    expect(items).toEqual(snapshot)
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterCatalogByName(items, 'zzz')).toEqual([])
  })
})
