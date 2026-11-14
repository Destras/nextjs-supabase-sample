import type { TabKey } from '../catalogItem'

// Resolves which catalog tab should render as active. The listing routes carry
// the tab in the path (/contenido/videos); the create/detail/edit routes carry
// it in the ?tipo query param instead, so the path alone can't tell which tab
// is active there (CON-017). Returns null when nothing matches.
const VALID_TABS: readonly TabKey[] = [
  'videos',
  'mantras',
  'egregores',
  'cma',
  'ic',
]

const isValidTab = (value: string): value is TabKey =>
  (VALID_TABS as readonly string[]).includes(value)

const resolveActiveTab = (
  pathname: string,
  tipoParam: string | null,
): TabKey | null => {
  const segment = pathname.split('/')[2] ?? ''
  if (isValidTab(segment)) return segment
  if (tipoParam && isValidTab(tipoParam)) return tipoParam
  return null
}

export { resolveActiveTab }
