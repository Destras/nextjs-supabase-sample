'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useFetchContenidoById,
  useFetchAllContenido,
  useFetchContenidoMediaUrl,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import type { Contenido } from '@/app/controllers/Contenido'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { contenidoToCatalogItem } from '@/app/contenido/controllers/catalogItem'
import type {
  TabKey,
  CatalogItem,
} from '@/app/contenido/controllers/catalogItem'
import { buildCatalogTabHref } from '@/app/contenido/controllers/utils/buildCatalogTabHref'
import { parseCatalogViewMode } from '@/app/contenido/controllers/utils/catalogViewMode'
import { parseCatalogQuery } from '@/app/contenido/controllers/utils/parseCatalogQuery'
import { useContenidoMutations } from '@/app/contenido/controllers/useContenidoMutations'
import type { UseContenidoMutationsResult } from '@/app/contenido/controllers/useContenidoMutations'

// Mirrors catalogItem.ts's TAB_BY_TIPO in the opposite direction — kept in
// sync deliberately, one entry per tab.
const TIPO_ENUM_BY_TAB: Record<TabKey, TIPO_CONTENIDO> = {
  videos: TIPO_CONTENIDO.VIDEO,
  mantras: TIPO_CONTENIDO.AUDIO,
  egregores: TIPO_CONTENIDO.EGREGOR,
  cma: TIPO_CONTENIDO.CMA,
  ic: TIPO_CONTENIDO.IC,
}

// CMA/IC galleries never carry a recursoRef (they use `imagenes` instead —
// the carousel is PR3 scope), so they are deliberately excluded here.
const PLAYABLE_TIPOS: ReadonlySet<TIPO_CONTENIDO> = new Set([
  TIPO_CONTENIDO.VIDEO,
  TIPO_CONTENIDO.AUDIO,
  TIPO_CONTENIDO.EGREGOR,
])

interface ContenidoDetailViewModelParams {
  readonly id: string
  readonly tipo: TabKey
}

interface ContenidoDetailViewModel extends UseContenidoMutationsResult {
  readonly item: Contenido | null
  readonly currentItem: CatalogItem | null
  readonly isLoading: boolean
  readonly notFound: boolean
  readonly isAdmin: boolean
  readonly backHref: string
  readonly editHref: string
  readonly playerSrc: string | null
  readonly isPlayerLoading: boolean
  readonly playerError: string | null
  readonly onPlaybackError: () => void
  readonly onPlayerRetry: () => void
  readonly hasArchivo: boolean
}

const useContenidoDetailViewModel = ({
  id,
  tipo,
}: ContenidoDetailViewModelParams): ContenidoDetailViewModel => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading: isResolvingRole } = useCurrentUserProfile()
  const isAdmin = profile?.role === ROLE.ADMIN

  const { contenido, isLoading: loadingContenido } = useFetchContenidoById(id)

  const item = contenido
  const isLoading = isResolvingRole || loadingContenido
  const notFound = !isLoading && item === null

  const currentItem: CatalogItem | null = item
    ? contenidoToCatalogItem(item)
    : null

  // El tipo que vale es el del contenido cargado; `tipo` (el `?tipo=` de la
  // URL, 'videos' si falta) solo cubre el rato en que todavía no cargó. Así un
  // enlace sin `?tipo=` o con uno equivocado no arma el "Volver", el "Editar"
  // ni los candidatos de reemplazo con otro tipo (BETA-044).
  const tab: TabKey = currentItem?.tab ?? tipo

  const { contenidos } = useFetchAllContenido()
  const tipoEnum = TIPO_ENUM_BY_TAB[tab]
  const allItems = contenidos
    .filter((c) => c.tipo === tipoEnum)
    .map(contenidoToCatalogItem)

  // La biblioteca vuelve filtrada: el listado puso `q`/`vista` en el link del
  // detalle y acá se reconstruye la URL del listado. Es el único destino de
  // vuelta: lo usan el link "Volver" y el redirect posterior a borrar/reemplazar.
  const backHref = buildCatalogTabHref(tab, {
    query: parseCatalogQuery(searchParams.get('q')),
    viewMode: parseCatalogViewMode(searchParams.get('vista')),
  })
  const editHref = `/contenido/${id}/editar?tipo=${tab}`

  const mutations = useContenidoMutations({
    items: allItems,
    refresh: () => {
      router.push(backHref)
    },
    isAdmin,
  })

  const recursoRef =
    item !== null && PLAYABLE_TIPOS.has(item.tipo)
      ? item.contenido.recursoRef
      : null

  const {
    src: playerSrc,
    isLoading: isPlayerLoading,
    error: signedUrlError,
    retry: retrySignedUrl,
  } = useFetchContenidoMediaUrl(recursoRef)

  // Runtime playback failures (e.g. signed URL points at a missing/expired
  // object → the <video>/<audio> 404s) are not surfaced by the signed-url
  // hook, so the media element raises them via onPlaybackError.
  const [hasPlaybackError, setHasPlaybackError] = useState(false)

  // A new media source clears any stale playback error.
  useEffect(() => {
    setHasPlaybackError(false)
  }, [recursoRef])

  const onPlaybackError = useCallback(() => {
    setHasPlaybackError(true)
  }, [])

  const onPlayerRetry = useCallback(() => {
    setHasPlaybackError(false)
    retrySignedUrl()
  }, [retrySignedUrl])

  const playerError =
    signedUrlError ?? (hasPlaybackError ? 'media_playback_failed' : null)

  const hasArchivo = recursoRef !== null

  return {
    item,
    currentItem,
    isLoading,
    notFound,
    isAdmin,
    backHref,
    editHref,
    playerSrc,
    isPlayerLoading,
    playerError,
    onPlaybackError,
    onPlayerRetry,
    hasArchivo,
    ...mutations,
  }
}

export type { ContenidoDetailViewModel, ContenidoDetailViewModelParams }
export { useContenidoDetailViewModel }
