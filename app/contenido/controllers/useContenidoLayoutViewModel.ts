'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useFetchAllContenido } from '@/app/controllers/Contenido'
import { contenidoToCatalogItem } from './catalogItem'
import type { TabKey } from './catalogItem'
import { buildCatalogTabHref } from './utils/buildCatalogTabHref'
import { parseCatalogViewMode } from './utils/catalogViewMode'
import { countCatalogByTab } from './utils/countCatalogByTab'
import { parseCatalogQuery } from './utils/parseCatalogQuery'
import { resolveActiveTab } from './utils/resolveActiveTab'

type TabTipo = 'videos' | 'mantras' | 'egregores' | 'cma' | 'ic'

interface ContenidoCounts {
  readonly videos: number
  readonly mantras: number
  readonly egregores: number
  readonly cma: number
  readonly ic: number
  readonly total: number
}

// Map y no un objeto: el segmento sale del pathname, o sea de la barra de
// direcciones. Indexar un objeto con eso devuelve lo que herede de
// Object.prototype, que no es nullish y se cuela por el `??`: entrar a
// /contenido/constructor armaba el link
// `/contenido/nuevo?tipo=function Object() { [native code] }`.
const SEGMENT_TO_TIPO = new Map<string, TabTipo>([
  ['videos', 'videos'],
  ['mantras', 'mantras'],
  ['egregores', 'egregores'],
  ['cma', 'cma'],
  ['ic', 'ic'],
])

interface ContenidoTabLink {
  readonly tab: TabKey
  readonly href: string
  readonly count: number
  readonly isActive: boolean
}

interface ContenidoLayoutViewModel {
  readonly isAdmin: boolean
  readonly isResolvingRole: boolean
  readonly nuevoHref: string
  readonly counts: ContenidoCounts
  readonly tabs: ReadonlyArray<ContenidoTabLink>
}

const TAB_ORDER: ReadonlyArray<TabKey> = [
  'videos',
  'mantras',
  'egregores',
  'cma',
  'ic',
]

const useContenidoLayoutViewModel = (): ContenidoLayoutViewModel => {
  const { profile, isLoading } = useCurrentUserProfile()
  const { contenidos, refresh: refreshContenidos } = useFetchAllContenido()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isAdmin = profile?.role === ROLE.ADMIN
  const isResolvingRole = isLoading

  // The counts live in this persistent layout, whose fetch hook loads once and
  // never re-runs — so after a create/delete (which navigates back to a listing)
  // the counts went stale until a full reload (CON-007). Refetch whenever the
  // pathname changes within /contenido/*; skip the initial mount since the
  // hook already fetches then.
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    void refreshContenidos()
  }, [pathname, refreshContenidos])

  const lastSegment = pathname.split('/').pop() ?? ''
  const tipo: TabTipo = SEGMENT_TO_TIPO.get(lastSegment) ?? 'videos'
  const nuevoHref = `/contenido/nuevo?tipo=${tipo}`

  // Per-tab counts follow the URL query; the header total stays unfiltered.
  const query = parseCatalogQuery(searchParams.get('q'))
  const viewMode = parseCatalogViewMode(searchParams.get('vista'))
  const tabCounts = countCatalogByTab(
    contenidos.map(contenidoToCatalogItem),
    query,
  )
  const total = contenidos.length
  const counts: ContenidoCounts = { ...tabCounts, total }

  const activeTab = resolveActiveTab(pathname, searchParams.get('tipo'))
  const tabs: ReadonlyArray<ContenidoTabLink> = TAB_ORDER.map((tab) => ({
    tab,
    href: buildCatalogTabHref(tab, { query, viewMode }),
    count: tabCounts[tab],
    isActive: tab === activeTab,
  }))

  return { isAdmin, isResolvingRole, nuevoHref, counts, tabs }
}

export type { ContenidoLayoutViewModel, ContenidoCounts, ContenidoTabLink }
export { useContenidoLayoutViewModel }
