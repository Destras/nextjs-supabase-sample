'use client'

import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import {
  useFetchPacientesByTerapeuta,
  useFetchPacientesSinIniciar,
} from '@/app/controllers/Paciente'
import type { PacienteSinIniciar } from '@/app/controllers/Paciente'
import { useFetchAlertasTerapeuta, ALERTA_TIPO } from '@/app/controllers/Alerta'
import type {
  DistItem,
  HeroStats,
  PacienteFila,
  EmptyStateContent,
} from './dashboardTypes'
import {
  buildSaludo,
  deriveDistribucionEtapa,
  deriveDistribucionMes,
  deriveHeroStats,
  deriveMesCalendarioLabels,
  deriveProyeccionMesSiguiente,
  deriveRequierenMirada,
  hasEvaluaciones,
  resolveEmptyStateContent,
} from './utils'

interface TerapeutaDashboardViewModel {
  readonly saludo: string
  readonly stats: HeroStats
  readonly requierenMirada: ReadonlyArray<PacienteFila>
  readonly distribucionEtapa: ReadonlyArray<DistItem>
  readonly distribucionMes: ReadonlyArray<DistItem>
  readonly distribucionMesSiguiente: ReadonlyArray<DistItem>
  readonly sinIniciar: ReadonlyArray<PacienteSinIniciar>
  readonly hasPacientes: boolean
  readonly hasEvaluaciones: boolean
  readonly isLoading: boolean
  readonly error: string | null
  readonly mesActualLabel: string // DEC-4 — nombre del mes calendario actual
  readonly mesSiguienteLabel: string // DEC-4 — nombre del mes calendario siguiente
  readonly emptyState: EmptyStateContent // DAS-001 — copy del empty state según rol
}

// Compone el caseload del terapeuta (useFetchPacientesByTerapeuta) con las
// alertas reales de su caseload (entidad Alerta — sin params:
// list_alertas_terapeuta() escopea por auth.uid() server-side; acá se filtra
// a `score_bajo` únicamente, DEC-2) y los
// derivadores puros (TDD, E1.1/C.2.2). "Requiere tu mirada" ya no aproxima
// con `tieneAlerta`: filtra contra el Set<pacienteId> de alertas activas.
// scorePromedio se resuelve dentro de deriveHeroStats. Toda la lógica vive en
// las funciones puras; el hook solo orquesta y expone el shape del DevSpec
// §5.3.
const useTerapeutaDashboardViewModel = (
  userId: string | null,
): TerapeutaDashboardViewModel => {
  const {
    pacientes,
    isLoading: isFetching,
    error,
  } = useFetchPacientesByTerapeuta(userId)
  const { pacientes: sinIniciar, isLoading: isFetchingSinIniciar } =
    useFetchPacientesSinIniciar(userId)
  const { profile, isLoading: isProfileLoading } = useCurrentUserProfile()
  const { alertas, isLoading: isFetchingAlertas } = useFetchAlertasTerapeuta()
  const now = new Date()

  // DEC-2: "requieren tu mirada" filtra solo alertas de score bajo — los
  // otros 3 tipos (eval_vencida/mes_3/fin) viven en /alertas, no acá.
  const alertaPacienteIds = new Set(
    alertas
      .filter((a) => a.tipo === ALERTA_TIPO.SCORE_BAJO)
      .map((a) => a.pacienteId),
  )
  const distribucionMes = deriveDistribucionMes(pacientes)
  const mesCalendarioLabels = deriveMesCalendarioLabels(now)
  // DAS-001: el admin también es terapeuta (misma vista, mismo hook) pero un
  // caseload propio vacío no es "recién arrancando" para él — resuelve la
  // copy correcta acá, la View solo la spreadea.
  const esAdmin = profile?.role === ROLE.ADMIN

  return {
    saludo: buildSaludo(profile?.name ?? null, now),
    stats: deriveHeroStats(pacientes, now),
    requierenMirada: deriveRequierenMirada(pacientes, alertaPacienteIds),
    distribucionEtapa: deriveDistribucionEtapa(pacientes),
    distribucionMes,
    distribucionMesSiguiente: deriveProyeccionMesSiguiente(distribucionMes),
    sinIniciar,
    hasPacientes: pacientes.length > 0,
    hasEvaluaciones: hasEvaluaciones(pacientes),
    isLoading:
      isFetching ||
      isFetchingSinIniciar ||
      isProfileLoading ||
      isFetchingAlertas,
    error,
    mesActualLabel: mesCalendarioLabels.actual,
    mesSiguienteLabel: mesCalendarioLabels.siguiente,
    emptyState: resolveEmptyStateContent(esAdmin),
  }
}

export type { TerapeutaDashboardViewModel }
export { useTerapeutaDashboardViewModel }
