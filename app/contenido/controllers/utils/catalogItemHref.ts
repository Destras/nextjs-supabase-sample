import type { CatalogItem } from '../catalogItem'
import { buildCatalogSearch } from './buildCatalogSearch'
import type { CatalogHrefState } from './buildCatalogTabHref'

// Detail link of a card / table row. Carries the APPLIED query and view mode
// next to `tipo` so the detail's back link can return to the filtered listing.
// Without filters it is exactly `/contenido/{id}?tipo={tab}`.
const catalogItemHref = (item: CatalogItem, state: CatalogHrefState): string =>
  `/contenido/${item.id}${buildCatalogSearch(`?tipo=${item.tab}`, { q: state.query, vista: state.viewMode })}`

export { catalogItemHref }
