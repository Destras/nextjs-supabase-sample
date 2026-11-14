import { normalizeForSearch } from '@/lib/normalizeForSearch'

// Name-only substring match, accent- and case-insensitive. A blank query
// applies no filter. Returns a new array; the input is never mutated.
const filterCatalogByName = <T extends { readonly nombre: string }>(
  items: ReadonlyArray<T>,
  query: string,
): ReadonlyArray<T> => {
  const needle = normalizeForSearch(query.trim())
  if (needle === '') return items
  return items.filter((item) =>
    normalizeForSearch(item.nombre).includes(needle),
  )
}

export { filterCatalogByName }
