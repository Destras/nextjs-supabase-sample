import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardErrorStateProps {
  readonly message?: string
  readonly onRetry?: () => void
}

// El mock no define un error state explícito (delta consciente): mismo patrón
// que `.empty` con ícono destructive + opción de reintentar.
const DashboardErrorState = ({
  message = 'No pudimos cargar el dashboard. Intentá de nuevo.',
  onRetry,
}: DashboardErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive/70" />
      <p className="text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export { DashboardErrorState }
export type { DashboardErrorStateProps }
