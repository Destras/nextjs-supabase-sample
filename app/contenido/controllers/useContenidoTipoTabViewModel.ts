'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  useFetchAllContenido,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { contenidoToCatalogItem } from './catalogItem'
import type { CatalogItem } from './catalogItem'
import { buildCatalogSearch } from './utils/buildCatalogSearch'
import type { CatalogSearchPatch } from './utils/buildCatalogSearch'
import { catalogItemHref } from './utils/catalogItemHref'
import {
  isCatalogViewMode,
  parseCatalogViewMode,
} from './utils/catalogViewMode'
import type { CatalogViewMode } from './utils/catalogViewMode'
import {
  readStoredCatalogViewMode,
  writeStoredCatalogViewMode,
} from './utils/catalogViewModeStorage'
import { filterCatalogByName } from './utils/filterCatalogByName'
import { parseCatalogQuery } from './utils/parseCatalogQuery'
import { resolveCatalogStatus } from './utils/resolveCatalogStatus'
import type { CatalogStatus } from './utils/resolveCatalogStatus'
import { sortCatalogByName } from './utils/sortCatalogByName'

// A listing item plus the detail link it navigates to. The link carries the
// APPLIED query / view mode (from the URL), never the text still being typed.
interface CatalogListItem extends CatalogItem {
  readonly href: string
}

const SEARCH_DEBOUNCE_MS = 200

// The URL is the source of truth for q / vista. It is written with the native
// History API (no navigation, no history entry) and reads window.location at
// call time, so a pending write never reverts a param changed in between.
const writeCatalogSearch = (patch: CatalogSearchPatch): void => {
  const { pathname, search } = window.location
  window.history.replaceState(
    null,
    '',
    pathname + buildCatalogSearch(search, patch),
  )
}

interface ContenidoTipoTabViewModel {
  readonly items: ReadonlyArray<CatalogListItem>
  readonly status: CatalogStatus
  readonly isLoading: boolean
  readonly error: string | null
  readonly isAdmin: boolean
  readonly searchInput: string
  readonly viewMode: CatalogViewMode
  readonly onSearchInputChange: (value: string) => void
  readonly onViewModeChange: (value: string) => void
  readonly onSearchBlur: () => void
}

const useContenidoTipoTabViewModel = (
  tipo: TIPO_CONTENIDO,
): ContenidoTipoTabViewModel => {
  const {
    profile,
    isLoading: isResolvingRole,
    error: profileError,
  } = useCurrentUserProfile()

  const {
    contenidos,
    isLoading: isFetching,
    error: fetchError,
  } = useFetchAllContenido()

  const searchParams = useSearchParams()
  const urlQuery = parseCatalogQuery(searchParams.get('q'))
  const viewMode = parseCatalogViewMode(searchParams.get('vista'))
  const [searchInput, setSearchInput] = useState(urlQuery)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{
    readonly value: string
    readonly pathname: string
  } | null>(null)
  // Last query this hook wrote to the URL. The URL catching up with it must
  // not overwrite characters typed in the meantime.
  const lastWrittenRef = useRef(urlQuery)
  // Whether the URL carried a vista param when the listing mounted (even an
  // invalid one): the URL wins over the remembered view mode.
  const hadVistaOnMountRef = useRef(searchParams.get('vista') !== null)

  // Applies the remembered table view once per mount, only as a default for a
  // URL without vista. Cards is "no param", so it never needs a write. Read
  // after mount, never during render: the server has no storage.
  useEffect(() => {
    if (hadVistaOnMountRef.current) return
    if (readStoredCatalogViewMode() === 'tabla') {
      writeCatalogSearch({ vista: 'tabla' })
    }
  }, [])

  // An external URL change wins over typing that has not been written yet:
  // the pending write is dropped so it cannot overwrite the new URL later.
  useEffect(() => {
    if (urlQuery === lastWrittenRef.current) return
    lastWrittenRef.current = urlQuery
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
    setSearchInput(urlQuery)
  }, [urlQuery])

  // Writes the pending query now (blur, unmount, debounce end). Skipped when
  // the pathname changed since it was scheduled: a tab navigation unmounts this
  // hook and the query must not land on the next tab's route.
  const flushPendingSearch = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (pending === null) return
    pendingRef.current = null
    if (window.location.pathname !== pending.pathname) return
    lastWrittenRef.current = parseCatalogQuery(pending.value)
    writeCatalogSearch({ q: pending.value })
  }, [])

  useEffect(() => flushPendingSearch, [flushPendingSearch])

  const onSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      pendingRef.current = { value, pathname: window.location.pathname }
      timerRef.current = setTimeout(flushPendingSearch, SEARCH_DEBOUNCE_MS)
    },
    [flushPendingSearch],
  )

  // The toggle emits '' when the active option is clicked again: ignore it so
  // exactly one mode stays selected.
  const onViewModeChange = useCallback((value: string) => {
    if (!isCatalogViewMode(value)) return
    writeStoredCatalogViewMode(value)
    writeCatalogSearch({ vista: value })
  }, [])

  const isAdmin = profile?.role === ROLE.ADMIN
  const isLoading = isResolvingRole || isFetching
  const error = profileError ?? fetchError

  const tabItems = useMemo(
    () => contenidos.filter((c) => c.tipo === tipo).map(contenidoToCatalogItem),
    [contenidos, tipo],
  )

  const filteredItems = useMemo(
    () => sortCatalogByName(filterCatalogByName(tabItems, urlQuery)),
    [tabItems, urlQuery],
  )

  const items: ReadonlyArray<CatalogListItem> = useMemo(
    () =>
      filteredItems.map((item) => ({
        ...item,
        href: catalogItemHref(item, { query: urlQuery, viewMode }),
      })),
    [filteredItems, urlQuery, viewMode],
  )

  const status = resolveCatalogStatus({
    isLoading,
    error,
    totalCount: tabItems.length,
    filteredCount: filteredItems.length,
    query: urlQuery,
  })

  return {
    items,
    status,
    isLoading,
    error,
    isAdmin,
    searchInput,
    viewMode,
    onSearchInputChange,
    onViewModeChange,
    onSearchBlur: flushPendingSearch,
  }
}

export type { ContenidoTipoTabViewModel, CatalogListItem }
export { useContenidoTipoTabViewModel }
