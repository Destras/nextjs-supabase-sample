import type { Paciente } from '@/app/controllers/Paciente'

// Tipos compartidos por los derivadores de métricas y los ViewModels del
// dashboard. Solo tipos (sin lógica): no llevan test.

interface DistItem {
  readonly label: string
  readonly cantidad: number
  readonly pct: number
}

interface HeroStats {
  readonly activos: number // T1 (Tier A)
  readonly nuevosEsteMes: number // T2 (Tier A)
  readonly scorePromedio: number | null // T8 reusado en el hero — null = sin evaluaciones aún
}

// "Requieren tu mirada" rinde directamente sobre el agregado Paciente.
type PacienteFila = Paciente

// Contrato del empty state de "Mis casos" (DAS-001) — resuelto en el
// ViewModel (resolveEmptyStateContent) según el rol, nunca re-derivado en la
// View. ctaLabel/ctaHref opcionales: el componente compartido
// (components/empty-state.tsx) solo renderiza el CTA si ambos están
// presentes. El ícono del CTA (ctaIcon) se pasa aparte en la View — es un
// detalle de presentación, no contenido del ViewModel.
interface EmptyStateContent {
  readonly title: string
  readonly titleHighlight?: string
  readonly message: string
  readonly ctaLabel?: string
  readonly ctaHref?: string
}

export type { DistItem, HeroStats, PacienteFila, EmptyStateContent }
