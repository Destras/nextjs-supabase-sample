import { Button } from '@/components/ui/button'

interface HistoriaErrorStateProps {
  readonly onRetry: () => void
}

const HistoriaErrorState = ({ onRetry }: HistoriaErrorStateProps) => (
  <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
    <p className="text-destructive">
      No pudimos cargar la historia del paciente.
    </p>
    <Button variant="outline" onClick={onRetry}>
      Reintentar
    </Button>
  </div>
)

export { HistoriaErrorState }
export type { HistoriaErrorStateProps }
