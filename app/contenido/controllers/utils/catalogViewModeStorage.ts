import { isCatalogViewMode } from './catalogViewMode'
import type { CatalogViewMode } from './catalogViewMode'

const STORAGE_KEY = 'contenido.vista'

// Storage can be unavailable or throw (private mode, blocked site data): that
// behaves as "nothing stored" and must never break the page.
const readStoredCatalogViewMode = (): CatalogViewMode | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored !== null && isCatalogViewMode(stored) ? stored : null
  } catch {
    return null
  }
}

const writeStoredCatalogViewMode = (mode: CatalogViewMode): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Not remembering the preference is harmless.
  }
}

export { readStoredCatalogViewMode, writeStoredCatalogViewMode }
