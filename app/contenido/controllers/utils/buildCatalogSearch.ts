import type { CatalogViewMode } from './catalogViewMode'
import { parseCatalogQuery } from './parseCatalogQuery'

interface CatalogSearchPatch {
  readonly q?: string
  readonly vista?: CatalogViewMode
}

// Applies a patch to the `q` / `vista` params of a search string and returns
// '' or '?…'. A blank `q` and the default `cards` view are removed from the
// URL; params not in the patch (and unrelated ones) are preserved.
const buildCatalogSearch = (
  currentSearch: string,
  patch: CatalogSearchPatch,
): string => {
  const params = new URLSearchParams(currentSearch)

  if (patch.q !== undefined) {
    const q = parseCatalogQuery(patch.q)
    if (q === '') params.delete('q')
    else params.set('q', q)
  }

  if (patch.vista !== undefined) {
    if (patch.vista === 'tabla') params.set('vista', 'tabla')
    else params.delete('vista')
  }

  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

export type { CatalogSearchPatch }
export { buildCatalogSearch }
