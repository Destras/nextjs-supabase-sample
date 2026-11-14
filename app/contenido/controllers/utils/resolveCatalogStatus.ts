type CatalogStatus =
  | 'loading'
  | 'error'
  | 'catalog-empty'
  | 'search-empty'
  | 'ready'

interface ResolveCatalogStatusInput {
  readonly isLoading: boolean
  readonly error: string | null
  // The tab's UNFILTERED item count.
  readonly totalCount: number
  readonly filteredCount: number
  // Parsed (trimmed) query.
  readonly query: string
}

// Precedence: loading > error > catalog-empty > search-empty > ready. A tab
// with no items is catalog-empty even when a query is active.
const resolveCatalogStatus = ({
  isLoading,
  error,
  totalCount,
  filteredCount,
  query,
}: ResolveCatalogStatusInput): CatalogStatus => {
  if (isLoading) return 'loading'
  if (error !== null) return 'error'
  if (totalCount === 0) return 'catalog-empty'
  if (query !== '' && filteredCount === 0) return 'search-empty'
  return 'ready'
}

export type { CatalogStatus, ResolveCatalogStatusInput }
export { resolveCatalogStatus }
