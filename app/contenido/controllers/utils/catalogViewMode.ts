type CatalogViewMode = 'cards' | 'tabla'

const isCatalogViewMode = (value: string): value is CatalogViewMode =>
  value === 'cards' || value === 'tabla'

// Exact match only: 'tabla' selects the table, anything else is cards.
const parseCatalogViewMode = (raw: string | null): CatalogViewMode =>
  raw === 'tabla' ? 'tabla' : 'cards'

export type { CatalogViewMode }
export { isCatalogViewMode, parseCatalogViewMode }
