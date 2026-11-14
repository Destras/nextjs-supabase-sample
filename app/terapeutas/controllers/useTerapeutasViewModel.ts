'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  useFetchAllTerapeutas,
  useRevokeInvitation,
  useResendInvitation,
  useDeactivateTerapeuta,
  useReactivateTerapeuta,
  resolveDesactivarErrorMessage,
} from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { useCurrentUserProfile } from '@/app/controllers/Auth'
import { ROLE } from '@/app/controllers/Auth'

interface TerapeutasViewModel {
  readonly terapeutas: ReadonlyArray<Terapeuta>
  readonly isLoading: boolean
  readonly error: string | null
  readonly isAdmin: boolean
  readonly isResolvingRole: boolean
  readonly isInvitarOpen: boolean
  readonly onOpenInvitar: () => void
  readonly onCloseInvitar: () => void
  readonly onInvitarSuccess: (mensaje: string) => void
  readonly revocarTarget: Terapeuta | null
  readonly isRevoking: boolean
  readonly revokeError: string | null
  readonly onOpenRevocar: (t: Terapeuta) => void
  readonly onCloseRevocar: () => void
  readonly onConfirmRevocar: () => Promise<void>
  readonly onResendInvitation: (t: Terapeuta) => Promise<void>
  readonly editarTarget: Terapeuta | null
  readonly onOpenEditar: (t: Terapeuta) => void
  readonly onCloseEditar: () => void
  readonly onEditarSuccess: (mensaje: string) => void
  readonly desactivarTarget: Terapeuta | null
  readonly desactivarMotivo: string
  readonly desactivarMotivoError: string | null
  readonly desactivarSubmitError: string | null
  readonly isDeactivating: boolean
  readonly onOpenDesactivar: (t: Terapeuta) => void
  readonly onCloseDesactivar: () => void
  readonly onDesactivarMotivoChange: (value: string) => void
  readonly onConfirmDesactivar: () => Promise<void>
  readonly onReactivar: (t: Terapeuta) => Promise<void>
}

const useTerapeutasViewModel = (): TerapeutasViewModel => {
  const {
    profile,
    isLoading: isResolvingRole,
    error: profileError,
  } = useCurrentUserProfile()

  const isAdmin = profile?.role === ROLE.ADMIN

  const {
    terapeutas,
    isLoading: isFetchingTerapeutas,
    error: fetchError,
    refresh,
  } = useFetchAllTerapeutas()
  // NOTA: useFetchAllTerapeutas siempre dispara; si no es admin la RPC
  // devuelve excepción y queda en fetchError — la View renderiza NotAuthorizedPage
  // antes de mirar el fetch. No vale la pena agregar un short-circuit que
  // complique el hook.

  const { mutate: revokeInvitation } = useRevokeInvitation()
  const { mutate: resendInvitation } = useResendInvitation()
  const { mutate: deactivateTerapeuta, isLoading: isDeactivating } =
    useDeactivateTerapeuta()
  const { mutate: reactivateTerapeuta } = useReactivateTerapeuta()

  const [isInvitarOpen, setIsInvitarOpen] = useState(false)
  const [revocarTarget, setRevocarTarget] = useState<Terapeuta | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [editarTarget, setEditarTarget] = useState<Terapeuta | null>(null)
  const [desactivarTarget, setDesactivarTarget] = useState<Terapeuta | null>(
    null,
  )
  const [desactivarMotivo, setDesactivarMotivo] = useState('')
  const [desactivarMotivoError, setDesactivarMotivoError] = useState<
    string | null
  >(null)
  const [desactivarSubmitError, setDesactivarSubmitError] = useState<
    string | null
  >(null)

  const onOpenInvitar = (): void => {
    setIsInvitarOpen(true)
  }

  const onCloseInvitar = (): void => {
    setIsInvitarOpen(false)
  }

  const onInvitarSuccess = (mensaje: string): void => {
    toast.success(mensaje)
    setIsInvitarOpen(false)
    refresh()
  }

  const onOpenRevocar = (t: Terapeuta): void => {
    setRevocarTarget(t)
    setRevokeError(null)
  }

  const onCloseRevocar = (): void => {
    setRevocarTarget(null)
    setRevokeError(null)
  }

  const onConfirmRevocar = async (): Promise<void> => {
    if (!revocarTarget) return
    setIsRevoking(true)
    const { ok } = await revokeInvitation({ terapeutaId: revocarTarget.id })
    setIsRevoking(false)
    if (ok) {
      toast.success('Invitación revocada.')
      setRevocarTarget(null)
      setRevokeError(null)
      refresh()
    } else {
      setRevokeError('No se pudo revocar la invitación. Intentá de nuevo.')
    }
  }

  const onResendInvitation = async (t: Terapeuta): Promise<void> => {
    const { ok } = await resendInvitation({ terapeutaId: t.id })
    if (ok) {
      toast.success(`Invitación reenviada a ${t.email}.`)
    } else {
      toast.error('No se pudo reenviar la invitación. Intentá de nuevo.')
    }
  }

  const onOpenEditar = (t: Terapeuta): void => {
    setEditarTarget(t)
  }

  const onCloseEditar = (): void => {
    setEditarTarget(null)
  }

  const onEditarSuccess = (mensaje: string): void => {
    toast.success(mensaje)
    setEditarTarget(null)
    refresh()
  }

  const onOpenDesactivar = (t: Terapeuta): void => {
    setDesactivarTarget(t)
    setDesactivarMotivo('')
    setDesactivarMotivoError(null)
    setDesactivarSubmitError(null)
  }

  const onCloseDesactivar = (): void => {
    setDesactivarTarget(null)
    setDesactivarMotivo('')
    setDesactivarMotivoError(null)
    setDesactivarSubmitError(null)
  }

  const onDesactivarMotivoChange = (value: string): void => {
    setDesactivarMotivo(value)
    setDesactivarMotivoError(null)
  }

  const onConfirmDesactivar = async (): Promise<void> => {
    if (!desactivarTarget) return
    if (!desactivarMotivo.trim()) {
      setDesactivarMotivoError('El motivo es obligatorio.')
      return
    }
    setDesactivarSubmitError(null)
    // NOTA: leemos el error code del result, NO del closure del hook —
    // `error`/`errorCount` del hook reflejan el render anterior (stale closure)
    // hasta que React procese el setState. El result viene directo del await
    // y siempre trae el código correcto. Mismo patrón que useInviteTerapeuta
    // (ver fix de TER-003, commit c13a0fa).
    const result = await deactivateTerapeuta({
      terapeutaId: desactivarTarget.id,
      motivo: desactivarMotivo.trim(),
    })
    if (result.ok) {
      toast.success('Terapeuta desactivado.')
      onCloseDesactivar()
      refresh()
      return
    }
    // Error path: NO cerrar el dialog ni refrescar la lista. Mostrar inline.
    setDesactivarSubmitError(
      resolveDesactivarErrorMessage(result.error, result.errorCount),
    )
  }

  const onReactivar = async (t: Terapeuta): Promise<void> => {
    const { ok } = await reactivateTerapeuta({ terapeutaId: t.id })
    if (ok) {
      toast.success('Terapeuta reactivado.')
      refresh()
    } else {
      toast.error('No pudimos reactivar al terapeuta.')
    }
  }

  return {
    terapeutas: isAdmin ? terapeutas : [],
    isLoading: isResolvingRole || isFetchingTerapeutas,
    error: profileError ?? (isAdmin ? fetchError : null),
    isAdmin,
    isResolvingRole,
    isInvitarOpen,
    onOpenInvitar,
    onCloseInvitar,
    onInvitarSuccess,
    revocarTarget,
    isRevoking,
    revokeError,
    onOpenRevocar,
    onCloseRevocar,
    onConfirmRevocar,
    onResendInvitation,
    editarTarget,
    onOpenEditar,
    onCloseEditar,
    onEditarSuccess,
    desactivarTarget,
    desactivarMotivo,
    desactivarMotivoError,
    desactivarSubmitError,
    isDeactivating,
    onOpenDesactivar,
    onCloseDesactivar,
    onDesactivarMotivoChange,
    onConfirmDesactivar,
    onReactivar,
  }
}

export type { TerapeutasViewModel }
export { useTerapeutasViewModel }
