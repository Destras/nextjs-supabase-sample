'use client'

import {
  useFetchTerapeutasDashboard,
  TERAPEUTA_STATE,
} from '@/app/controllers/Terapeuta'
import type { TerapeutaRollup } from '@/app/controllers/Terapeuta'
import { useFetchAdminDashboardStats } from '@/app/controllers/AdminDashboard'
import type { DistItem } from './dashboardTypes'
import {
  deriveMesCalendarioLabels,
  deriveProyeccionMesSiguiente,
} from './utils'

interface AdminDashboardViewModel {
  readonly stats: {
    readonly pacientesActivos: number // A1 (A)
    readonly nuevosEsteMes: number // A10 — delta del hero A1 (A)
    readonly terapeutasActivos: number // A2 (A)
    readonly invitacionesPendientes: number // A3 (A)
    readonly alertasTotales: number | null // A4 (B) — null = sin evaluaciones
  }
  readonly cargaPorTerapeuta: ReadonlyArray<TerapeutaRollup> // A5
  readonly distribucionEtapa: ReadonlyArray<DistItem> // A9
  readonly distribucionMes: ReadonlyArray<DistItem> // A9b — mes de tratamiento, foto de hoy
  // Proyección +1 mes (§16.1 DevSpec): corrimiento determinista de
  // distribucionMes, no un fetch nuevo. Mes 1 = null (nuevas altas, no se inventan).
  readonly distribucionMesSiguiente: ReadonlyArray<DistItem>
  readonly hasTerapeutas: boolean
  readonly isLoading: boolean
  readonly error: string | null
  readonly mesActualLabel: string // DEC-4 — nombre del mes calendario actual
  readonly mesSiguienteLabel: string // DEC-4 — nombre del mes calendario siguiente
}

// Compone el rollup por terapeuta (entidad Terapeuta) + los agregados de la red
// (entidad AdminDashboard). terapeutasActivos / invitacionesPendientes se
// derivan del rollup por estado; pacientesActivos / alertas / distribuciones
// vienen del RPC global.
const useAdminDashboardViewModel = (): AdminDashboardViewModel => {
  const {
    terapeutas: rollup,
    isLoading: rollupLoading,
    error: rollupError,
  } = useFetchTerapeutasDashboard()
  const {
    stats,
    isLoading: statsLoading,
    error: statsError,
  } = useFetchAdminDashboardStats()

  const distribucionMes = stats?.distribucionMes ?? []
  const mesCalendarioLabels = deriveMesCalendarioLabels(new Date())
  // Solo activos: los pendientes ya se surfacean en el hero stat
  // "Invitaciones pendientes" — la tabla se enfoca en quién está trabajando.
  const terapeutasActivos = rollup.filter(
    (t) => t.estado === TERAPEUTA_STATE.ACTIVO,
  )

  return {
    stats: {
      pacientesActivos: stats?.pacientesActivos ?? 0,
      nuevosEsteMes: stats?.nuevosEsteMes ?? 0,
      terapeutasActivos: rollup.filter(
        (t) => t.estado === TERAPEUTA_STATE.ACTIVO,
      ).length,
      invitacionesPendientes: rollup.filter(
        (t) => t.estado === TERAPEUTA_STATE.PENDIENTE,
      ).length,
      alertasTotales: stats?.alertasTotales ?? null,
    },
    cargaPorTerapeuta: terapeutasActivos,
    distribucionEtapa: stats?.distribucionEtapa ?? [],
    distribucionMes,
    distribucionMesSiguiente: deriveProyeccionMesSiguiente(distribucionMes),
    // Coherente con cargaPorTerapeuta (misma lista filtrada): si toda la red
    // está "pendiente", la tabla queda vacía y el empty state debe activarse.
    hasTerapeutas: terapeutasActivos.length > 0,
    isLoading: rollupLoading || statsLoading,
    error: statsError ?? rollupError,
    mesActualLabel: mesCalendarioLabels.actual,
    mesSiguienteLabel: mesCalendarioLabels.siguiente,
  }
}

export type { AdminDashboardViewModel }
export { useAdminDashboardViewModel }
