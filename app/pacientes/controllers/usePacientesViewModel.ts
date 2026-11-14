'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  useFetchPacientesByTerapeuta,
  marcarAlertas,
  PACIENTE_STATE,
} from '@/app/controllers/Paciente'
import { useFetchAlertasTerapeuta } from '@/app/controllers/Alerta'
import type { Paciente } from '@/app/controllers/Paciente'
import { useCurrentUserId } from '@/app/controllers/Auth'
import { normalizeForSearch } from '@/lib/normalizeForSearch'

type PacientesFilter = 'todos' | 'activos' | 'alerta'

const FILTERS: ReadonlyArray<PacientesFilter> = ['todos', 'activos', 'alerta']

// Permite un deep-link como /pacientes?filtro=alerta (p.ej. desde el dashboard).
const resolveInitialFilter = (raw: string | null): PacientesFilter =>
  FILTERS.includes(raw as PacientesFilter) ? (raw as PacientesFilter) : 'todos'

const isPacienteActivo = (p: Paciente): boolean =>
  p.state === PACIENTE_STATE.ACTIVE

interface PacientesCounts {
  readonly total: number
  readonly activos: number
  readonly conAlerta: number
}

interface PacientesViewModel {
  readonly pacientes: ReadonlyArray<Paciente>
  readonly isLoading: boolean
  readonly error: string | null
  readonly filter: PacientesFilter
  readonly setFilter: (filter: PacientesFilter) => void
  readonly searchQuery: string
  readonly setSearchQuery: (query: string) => void
  readonly counts: PacientesCounts
}

const usePacientesViewModel = (): PacientesViewModel => {
  const {
    userId: terapeutaId,
    error: authError,
    isLoading: isResolvingUser,
  } = useCurrentUserId()

  const {
    pacientes: pacientesCrudos,
    isLoading: isFetchingPacientes,
    error: fetchError,
  } = useFetchPacientesByTerapeuta(terapeutaId)

  // "Con alerta" sale del motor de alertas (las mismas de la bandeja, ya sin
  // las atendidas), no del score. list_alertas_terapeuta() escopea por
  // auth.uid() server-side. A propósito NO se suma su isLoading/error al
  // ViewModel: la lista no espera a las alertas; mientras cargan, o si su
  // fetch falla, nadie queda marcado.
  const { alertas } = useFetchAlertasTerapeuta()

  const pacientes = useMemo(
    () => marcarAlertas(pacientesCrudos, alertas),
    [pacientesCrudos, alertas],
  )

  const searchParams = useSearchParams()
  const filtroParam = searchParams.get('filtro')
  const [filter, setFilter] = useState<PacientesFilter>(() =>
    resolveInitialFilter(filtroParam),
  )
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Sincroniza el filtro con el query param. Necesario porque Next reusa el
  // componente montado al navegar entre /pacientes y /pacientes?filtro=… (mismo
  // pathname): sin esto el initializer del useState no vuelve a correr y un
  // deep-link como /pacientes?filtro=alerta desde el dashboard se ignoraba.
  useEffect(() => {
    setFilter(resolveInitialFilter(filtroParam))
  }, [filtroParam])

  const counts = useMemo<PacientesCounts>(
    () => ({
      total: pacientes.length,
      // "Paciente activo" (CONTEXT.md) = estado `activo`. Pausados y bajas
      // no cuentan; tener o no un tratamiento en curso no cambia nada.
      activos: pacientes.filter(isPacienteActivo).length,
      conAlerta: pacientes.filter((p) => p.tieneAlerta).length,
    }),
    [pacientes],
  )

  const filtered = useMemo<ReadonlyArray<Paciente>>(() => {
    const byFilter = pacientes.filter((p) => {
      if (filter === 'activos') return isPacienteActivo(p)
      if (filter === 'alerta') return p.tieneAlerta
      return true
    })
    const q = normalizeForSearch(searchQuery.trim())
    const bySearch =
      q === ''
        ? byFilter
        : byFilter.filter((p) => normalizeForSearch(p.nombre).includes(q))
    // Los no activos (pausados y dados de baja) van al fondo. Se parte la lista
    // en dos en vez de ordenarla para no tocar el orden relativo del resto.
    return [
      ...bySearch.filter(isPacienteActivo),
      ...bySearch.filter((p) => !isPacienteActivo(p)),
    ]
  }, [pacientes, filter, searchQuery])

  return {
    pacientes: filtered,
    isLoading: isResolvingUser || isFetchingPacientes,
    error: authError ?? fetchError,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    counts,
  }
}

export type { PacientesViewModel, PacientesFilter, PacientesCounts }
export { usePacientesViewModel }
