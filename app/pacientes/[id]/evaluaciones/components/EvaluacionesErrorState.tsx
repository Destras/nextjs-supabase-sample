import { Button } from '@/components/ui/button'

interface EvaluacionesErrorStateProps {
  readonly onRetry: () => void
}

const EvaluacionesErrorState = ({ onRetry }: EvaluacionesErrorStateProps) => (
  <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
    <p className="text-destructive">
      No pudimos cargar las evaluaciones del paciente.
    </p>
    <Button variant="outline" onClick={onRetry}>
      Reintentar
    </Button>
  </div>
)

export { EvaluacionesErrorState }
export type { EvaluacionesErrorStateProps }
