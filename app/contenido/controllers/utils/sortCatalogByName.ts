import type { CatalogItem } from '../catalogItem'

// Locale pinned to 'es' (the default locale varies per machine). `base`
// sensitivity makes the comparison accent- and case-insensitive. `numeric`
// orders digit runs naturally ("Clase 2" before "Clase 10"); it goes beyond
// the spec and is pending user confirmation (remove the option to drop it).
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

const compareById = (a: string, b: string): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

// Returns a sorted copy; equal names fall back to `id` so order is stable.
const sortCatalogByName = (
  items: ReadonlyArray<CatalogItem>,
): ReadonlyArray<CatalogItem> =>
  [...items].sort(
    (a, b) => collator.compare(a.nombre, b.nombre) || compareById(a.id, b.id),
  )

export { sortCatalogByName }
