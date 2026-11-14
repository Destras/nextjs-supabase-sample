import type { CatalogItem, TabKey } from '../catalogItem'
import { filterCatalogByName } from './filterCatalogByName'

// Per-tab count of the items matching the query (all items when it is blank).
const countCatalogByTab = (
  items: ReadonlyArray<CatalogItem>,
  query: string,
): Record<TabKey, number> => {
  const counts: Record<TabKey, number> = {
    videos: 0,
    mantras: 0,
    egregores: 0,
    cma: 0,
    ic: 0,
  }
  for (const item of filterCatalogByName(items, query)) {
    counts[item.tab] += 1
  }
  return counts
}

export { countCatalogByTab }
