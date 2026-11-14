import { Sparkles } from 'lucide-react'

// Leyenda honesta para las métricas Tier B (score/alertas/seguimientos) que
// arrancan vacías día-1. Copy default = canal del paciente (ProdSpec §8.2). El
// mensaje es override-able para la variante de agenda (Próximos seguimientos).
const TIER_B_CANAL_PACIENTE =
  'Aún no hay evaluaciones registradas. Estas métricas se completarán cuando los pacientes empiecen a responder.'

interface TierBEmptyStateProps {
  readonly message?: string
}

const TierBEmptyState = ({
  message = TIER_B_CANAL_PACIENTE,
}: TierBEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Sparkles className="h-6 w-6 text-muted-foreground/50" />
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export { TierBEmptyState, TIER_B_CANAL_PACIENTE }
export type { TierBEmptyStateProps }
