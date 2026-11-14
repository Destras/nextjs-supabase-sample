'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useFetchTerapeutaById,
  useDeactivateTerapeuta,
  useReactivateTerapeuta,
  resolveDesactivarErrorMessage,
} from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import {
  useFetchAlertasByTerapeuta,
  ALERTA_TIPO,
} from '@/app/controllers/Alerta'
import type { Alerta } from '@/app/controllers/Alerta'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'

interface TerapeutaDetailViewModel {
  readonly terapeuta: Terapeuta | null
  readonly pacientes: ReadonlyArray<Paciente>
  readonly isLoading: boolean
  readonly error: string | null
  readonly isAdmin: boolean
  readonly isResolvingRole: boolean
  readonly notFound: boolean
  // editar modal
  readonly editarOpen: boolean
  readonly onOpenEditar: () => void
  readonly onCloseEditar: () => void
  readonly onEditarSuccess: (mensaje: string) => void
  // desactivar dialog
  readonly desactivarTarget: Terapeuta | null
  readonly desactivarMotivo: string
  readonly desactivarMotivoError: string | null
  readonly desactivarSubmitError: string | null
  readonly isDeactivating: boolean
  readonly onOpenDesactivar: () => void
  readonly onCloseDesactivar: () => void
  readonly onDesactivarMotivoChange: (value: string) => void
  readonly onConfirmDesactivar: () => Promise<void>
  // reactivar
  readonly onReactivar: () => Promise<void>
  // pacientes table click
  readonly onOpenPaciente: (pacienteId: string, alerta?: Alerta) => void
  // alertas section (Task 2.3, read-only drill-down)
  readonly alertas: ReadonlyArray<Alerta>
  readonly isLoadingAlertas: boolean
  readonly alertasError: string | null
}

const useTerapeutaDetailViewModel = (
  terapeutaId: string,
): TerapeutaDetailViewModel => {
  const router = useRouter()
  const { profile, isLoading: isResolvingRole } = useCurrentUserProfile()
  const isAdmin = profile?.role === ROLE.ADMIN

  const {
    terapeuta,
    isLoading: isFetchingTerapeuta,
    error: terapeutaError,
    refresh: refreshTerapeuta,
  } = useFetchTerapeutaById(isAdmin ? terapeutaId : null)

  const {
    pacientes,
    isLoading: isFetchingPacientes,
    error: pacientesError,
  } = useFetchPacientesByTerapeuta(isAdmin && terapeuta ? terapeutaId : null)

  const {
    alertas,
    isLoading: isLoadingAlertas,
    error: alertasError,
  } = useFetchAlertasByTerapeuta(isAdmin ? terapeutaId : null)

  const { mutate: deactivateTerapeuta, isLoading: isDeactivating } =
    useDeactivateTerapeuta()

  const { mutate: reactivateTerapeuta } = useReactivateTerapeuta()

  const [editarOpen, setEditarOpen] = useState(false)
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

  const notFound =
    isAdmin && !isFetchingTerapeuta && !terapeutaError && terapeuta === null

  const onOpenEditar = (): void => {
    setEditarOpen(true)
  }

  const onCloseEditar = (): void => {
    setEditarOpen(false)
  }

  const onEditarSuccess = (mensaje: string): void => {
    toast.success(mensaje)
    setEditarOpen(false)
    refreshTerapeuta()
  }

  const onOpenDesactivar = (): void => {
    setDesactivarTarget(terapeuta)
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
    // El código de error sale del result del mutate, NO del `error` del hook:
    // ese valor es del render anterior (stale closure) y al primer intento
    // todavía vale null. Mismo patrón que useTerapeutasViewModel (TER-003).
    const result = await deactivateTerapeuta({
      terapeutaId: desactivarTarget.id,
      motivo: desactivarMotivo.trim(),
    })
    if (result.ok) {
      toast.success('Terapeuta desactivado.')
      onCloseDesactivar()
      refreshTerapeuta()
      return
    }
    setDesactivarSubmitError(
      resolveDesactivarErrorMessage(result.error, result.errorCount),
    )
  }

  const onReactivar = async (): Promise<void> => {
    if (!terapeuta) return
    const { ok } = await reactivateTerapeuta({ terapeutaId: terapeuta.id })
    if (ok) {
      toast.success('Terapeuta reactivado.')
      refreshTerapeuta()
    } else {
      toast.error('No pudimos reactivar al terapeuta.')
    }
  }

  // medicion_cierre_pendiente lleva directo al diálogo de finalización
  // (`?finalizar=1`, leído por TratamientoActions) en vez del bare route —
  // ese bare route hace un `redirect()` server-side que no preserva el query
  // string, así que acá se apunta a `/camino` explícito.
  const onOpenPaciente = (pacienteId: string, alerta?: Alerta): void => {
    if (alerta?.tipo === ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE) {
      router.push(`/pacientes/${pacienteId}/camino?finalizar=1`)
      return
    }
    router.push(`/pacientes/${pacienteId}`)
  }

  return {
    terapeuta,
    pacientes,
    isLoading: isResolvingRole || isFetchingTerapeuta || isFetchingPacientes,
    error: terapeutaError ?? pacientesError,
    isAdmin,
    isResolvingRole,
    notFound,
    editarOpen,
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
    onOpenPaciente,
    alertas,
    isLoadingAlertas,
    alertasError,
  }
}

export type { TerapeutaDetailViewModel }
export { useTerapeutaDetailViewModel }
