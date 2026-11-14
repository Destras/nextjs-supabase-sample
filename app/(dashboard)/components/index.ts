export { StatCard } from './StatCard'
export type { StatCardProps, Trend } from './StatCard'
export { DashboardCard } from './DashboardCard'
export type { DashboardCardProps } from './DashboardCard'
export { DistributionBars } from './DistributionBars'
export type { DistributionBarsProps } from './DistributionBars'
export { DashboardLoadingState } from './DashboardLoadingState'
export { DashboardErrorState } from './DashboardErrorState'
export type { DashboardErrorStateProps } from './DashboardErrorState'
export { TierBEmptyState, TIER_B_CANAL_PACIENTE } from './TierBEmptyState'
export type { TierBEmptyStateProps } from './TierBEmptyState'

// ScorePill se reusa del módulo de pacientes (no se duplica). Único punto de
// import para el dashboard.
export { ScorePill } from '@/app/pacientes/components/ScorePill'
export type { ScorePillProps } from '@/app/pacientes/components/ScorePill'

// Secciones del dashboard terapeuta (E1.3).
export { TerapeutaHeroStats } from './TerapeutaHeroStats'
export type { TerapeutaHeroStatsProps } from './TerapeutaHeroStats'
export { RequierenMiradaTable } from './RequierenMiradaTable'
export type { RequierenMiradaTableProps } from './RequierenMiradaTable'
export { SinIniciarCard } from './SinIniciarCard'
export type { SinIniciarCardProps } from './SinIniciarCard'
export { DistribucionCard } from './DistribucionCard'
export type { DistribucionCardProps } from './DistribucionCard'
export { DistribucionesRow } from './DistribucionesRow'
export type { DistribucionesRowProps } from './DistribucionesRow'

// Secciones del dashboard admin (E2.3).
export { AdminHeroStats } from './AdminHeroStats'
export type { AdminHeroStatsProps } from './AdminHeroStats'
export { CargaPorTerapeutaTable } from './CargaPorTerapeutaTable'
export type { CargaPorTerapeutaTableProps } from './CargaPorTerapeutaTable'
