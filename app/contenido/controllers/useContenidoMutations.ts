'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCountContenidoUsage,
  useDeleteContenido,
  useReplaceAndDeleteContenido,
} from '@/app/controllers/Contenido'
import type { CatalogItem } from './catalogItem'
import { formatReemplazoToast } from './utils/formatReemplazoToast'

interface UseContenidoMutationsParams {
  readonly items: ReadonlyArray<CatalogItem>
  readonly refresh: () => void | Promise<void>
  readonly isAdmin: boolean
}

interface UseContenidoMutationsResult {
  readonly deleteTarget: CatalogItem | null
  readonly replaceTarget: CatalogItem | null
  readonly affectedCount: number
  readonly candidates: ReadonlyArray<CatalogItem>
  readonly selectedReplacementId: string | null
  readonly isCounting: boolean
  readonly isDeleting: boolean
  readonly isReplacing: boolean
  readonly deleteError: string | null
  readonly replaceError: string | null
  readonly onAskDelete: (item: CatalogItem) => Promise<void>
  readonly onConfirmDelete: () => Promise<void>
  readonly onSelectReplacement: (id: string) => void
  readonly onConfirmReplace: () => Promise<void>
  readonly onCloseDelete: () => void
  readonly onCloseReplace: () => void
}

const mapDeleteError = (code: string | null | undefined): string => {
  if (code === 'no_encontrado') {
    return 'No encontramos el contenido. Puede que ya haya sido eliminado.'
  }
  if (code === 'en_uso') {
    return 'Este contenido se asignó a un paciente mientras lo eliminabas. Volvé a intentar.'
  }
  // tipo_distinto, no_autorizado, and any unknown → generic bucket
  return 'No pudimos eliminar el contenido. Intentá de nuevo.'
}

const REPLACE_ERROR_COPY =
  'No pudimos completar el reemplazo. No se eliminó nada. Intentá de nuevo.'

const useContenidoMutations = ({
  items,
  refresh,
  isAdmin,
}: UseContenidoMutationsParams): UseContenidoMutationsResult => {
  const { mutate: countContenido, isLoading: isCounting } =
    useCountContenidoUsage()
  const { mutate: deleteContenido, isLoading: isDeleting } =
    useDeleteContenido()
  const { mutate: replaceContenido, isLoading: isReplacing } =
    useReplaceAndDeleteContenido()

  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null)
  const [replaceTarget, setReplaceTarget] = useState<CatalogItem | null>(null)
  const [affectedCount, setAffectedCount] = useState<number>(0)
  const [candidates, setCandidates] = useState<ReadonlyArray<CatalogItem>>([])
  const [selectedReplacementId, setSelectedReplacementId] = useState<
    string | null
  >(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [replaceError, setReplaceError] = useState<string | null>(null)

  const onAskDelete = async (item: CatalogItem): Promise<void> => {
    if (!isAdmin) return

    const countResult = await countContenido({ id: item.id })

    if (!countResult.ok) {
      // Don't swallow the count failure silently — the user clicked Eliminar and
      // would otherwise see nothing happen (CON-015).
      toast.error('No pudimos preparar la eliminación. Intentá de nuevo.')
      return
    }

    const count = countResult.count ?? 0

    if (count === 0) {
      setDeleteTarget(item)
    } else {
      const filteredCandidates = items.filter((i) => i.id !== item.id)
      setAffectedCount(count)
      setCandidates(filteredCandidates)
      setReplaceTarget(item)
    }
  }

  const onConfirmDelete = async (): Promise<void> => {
    if (!isAdmin) return
    if (!deleteTarget) return

    const result = await deleteContenido({ id: deleteTarget.id })

    if (result.ok) {
      toast.success('Contenido eliminado.')
      setDeleteTarget(null)
      setDeleteError(null)
      refresh()
      return
    }

    const errorCode = result.error

    if (errorCode === 'no_encontrado') {
      setDeleteError(mapDeleteError('no_encontrado'))
      refresh()
      return
    }

    if (errorCode === 'en_uso') {
      // Race condition: item got assigned while trying to delete.
      // Reopen the replace dialog with fresh candidates. Re-consult the count
      // RPC so the dialog shows the real number of affected pacientes (>= 1),
      // never the stale 0 from the original onAskDelete check (CON-021).
      const recountResult = await countContenido({ id: deleteTarget.id })
      const recount = recountResult.ok ? (recountResult.count ?? 0) : 0
      const filteredCandidates = items.filter((i) => i.id !== deleteTarget.id)
      // Route the explanation to replaceError: the delete-dialog closes here and
      // the replace-dialog (which renders `replaceError`) opens, so deleteError
      // would never be seen (CON-022).
      setDeleteError(null)
      setReplaceError(mapDeleteError('en_uso'))
      setAffectedCount(Math.max(recount, 1))
      setCandidates(filteredCandidates)
      setReplaceTarget(deleteTarget)
      setDeleteTarget(null)
      return
    }

    // tipo_distinto, no_autorizado, and any unknown → generic bucket
    setDeleteError(mapDeleteError(errorCode))
  }

  const onSelectReplacement = (id: string): void => {
    setSelectedReplacementId(id)
  }

  const onConfirmReplace = async (): Promise<void> => {
    if (!isAdmin) return
    if (!replaceTarget || !selectedReplacementId) return

    const result = await replaceContenido({
      oldId: replaceTarget.id,
      newId: selectedReplacementId,
    })

    if (result.ok) {
      const affected = (result as { affected?: number }).affected ?? 0
      toast.success(formatReemplazoToast(affected))
      setReplaceTarget(null)
      setReplaceError(null)
      setSelectedReplacementId(null)
      setCandidates([])
      setAffectedCount(0)
      refresh()
      return
    }

    setReplaceError(REPLACE_ERROR_COPY)
  }

  const onCloseDelete = (): void => {
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const onCloseReplace = (): void => {
    setReplaceTarget(null)
    setSelectedReplacementId(null)
    setReplaceError(null)
    setAffectedCount(0)
    setCandidates([])
  }

  return {
    deleteTarget,
    replaceTarget,
    affectedCount,
    candidates,
    selectedReplacementId,
    isCounting,
    isDeleting,
    isReplacing,
    deleteError,
    replaceError,
    onAskDelete,
    onConfirmDelete,
    onSelectReplacement,
    onConfirmReplace,
    onCloseDelete,
    onCloseReplace,
  }
}

export type { UseContenidoMutationsParams, UseContenidoMutationsResult }
export { useContenidoMutations }
