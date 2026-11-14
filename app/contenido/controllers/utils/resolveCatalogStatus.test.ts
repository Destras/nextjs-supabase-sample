import { resolveCatalogStatus } from './resolveCatalogStatus'

interface Input {
  readonly isLoading: boolean
  readonly error: string | null
  readonly totalCount: number
  readonly filteredCount: number
  readonly query: string
}

describe('resolveCatalogStatus', () => {
  let input: Input

  beforeEach(() => {
    input = {
      isLoading: false,
      error: null,
      totalCount: 5,
      filteredCount: 5,
      query: '',
    }
  })

  it('reports loading even when there is also an error', () => {
    expect(
      resolveCatalogStatus({ ...input, isLoading: true, error: 'boom' }),
    ).toBe('loading')
  })

  it('reports error when not loading', () => {
    expect(resolveCatalogStatus({ ...input, error: 'boom' })).toBe('error')
  })

  it('reports catalog-empty when the tab has no items and there is no query', () => {
    expect(
      resolveCatalogStatus({ ...input, totalCount: 0, filteredCount: 0 }),
    ).toBe('catalog-empty')
  })

  it('reports catalog-empty, not search-empty, when the tab has no items and there is a query', () => {
    expect(
      resolveCatalogStatus({
        ...input,
        totalCount: 0,
        filteredCount: 0,
        query: 'medit',
      }),
    ).toBe('catalog-empty')
  })

  it('reports search-empty when the catalog has items but the query matches none', () => {
    expect(
      resolveCatalogStatus({ ...input, filteredCount: 0, query: 'medit' }),
    ).toBe('search-empty')
  })

  it('reports ready when the catalog has items and the query is blank', () => {
    expect(resolveCatalogStatus(input)).toBe('ready')
  })

  it('reports ready when the query matches some items', () => {
    expect(
      resolveCatalogStatus({ ...input, filteredCount: 2, query: 'medit' }),
    ).toBe('ready')
  })
})
