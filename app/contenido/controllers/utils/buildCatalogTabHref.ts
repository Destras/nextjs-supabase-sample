import type { TabKey } from '../catalogItem'
import { buildCatalogSearch } from './buildCatalogSearch'
import type { CatalogViewMode } from './catalogViewMode'

interface CatalogHrefState {
  readonly query: string
  readonly viewMode: CatalogViewMode
}

// Built from scratch (not cloned from the current URL) so a `tipo` param from
// a detail route never leaks into the tab links.
const buildCatalogTabHref = (tab: TabKey, state: CatalogHrefState): string =>
  `/contenido/${tab}${buildCatalogSearch('', { q: state.query, vista: state.viewMode })}`

export type { CatalogHrefState }
export { buildCatalogTabHref }
