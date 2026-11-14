import type { CatalogItem } from '../catalogItem'
import { sortCatalogByName } from './sortCatalogByName'

const buildItem = (id: string, nombre: string): CatalogItem => ({
  id,
  source: 'contenido',
  tab: 'videos',
  nombre,
  descripcion: null,
  isPlayable: false,
  duracionSeg: null,
})

const names = (items: ReadonlyArray<CatalogItem>): ReadonlyArray<string> =>
  items.map((item) => item.nombre)

describe('sortCatalogByName', () => {
  it('sorts alphabetically', () => {
    expect(
      names(
        sortCatalogByName([
          buildItem('1', 'Zeta'),
          buildItem('2', 'alfa'),
          buildItem('3', 'Beta'),
        ]),
      ),
    ).toEqual(['alfa', 'Beta', 'Zeta'])
  })

  it('interleaves accented letters with their base letter', () => {
    expect(
      names(
        sortCatalogByName([
          buildItem('1', 'Émbolo'),
          buildItem('2', 'Eco'),
          buildItem('3', 'Ánima'),
          buildItem('4', 'Zen'),
        ]),
      ),
    ).toEqual(['Ánima', 'Eco', 'Émbolo', 'Zen'])
  })

  it('ignores case', () => {
    expect(
      names(
        sortCatalogByName([
          buildItem('1', 'b'),
          buildItem('2', 'A'),
          buildItem('3', 'c'),
        ]),
      ),
    ).toEqual(['A', 'b', 'c'])
  })

  it('breaks ties by id when the input is in one order', () => {
    expect(
      sortCatalogByName([
        buildItem('b-2', 'Igual'),
        buildItem('a-1', 'Igual'),
      ]).map((item) => item.id),
    ).toEqual(['a-1', 'b-2'])
  })

  it('breaks ties by id when the input is in the reverse order', () => {
    expect(
      sortCatalogByName([
        buildItem('a-1', 'Igual'),
        buildItem('b-2', 'Igual'),
      ]).map((item) => item.id),
    ).toEqual(['a-1', 'b-2'])
  })

  it('does not mutate the input array', () => {
    const input = [buildItem('1', 'Zeta'), buildItem('2', 'Alfa')]
    sortCatalogByName(input)
    expect(names(input)).toEqual(['Zeta', 'Alfa'])
  })

  it('returns an empty array for an empty list', () => {
    expect(sortCatalogByName([])).toEqual([])
  })

  // PENDING USER CONFIRMATION (beyond spec, T1.8b). To drop: delete this test
  // and the `numeric: true` collator option.
  it("orders numeric runs naturally: 'Clase 2' before 'Clase 10'", () => {
    expect(
      names(
        sortCatalogByName([
          buildItem('1', 'Clase 10'),
          buildItem('2', 'Clase 2'),
        ]),
      ),
    ).toEqual(['Clase 2', 'Clase 10'])
  })
})
