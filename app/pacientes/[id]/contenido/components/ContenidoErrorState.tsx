import { Button } from '@/components/ui/button'

interface ContenidoErrorStateProps {
  readonly onRetry: () => void
}

const ContenidoErrorState = ({ onRetry }: ContenidoErrorStateProps) => (
  <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
    <p className="text-destructive">
      No pudimos cargar el contenido. Intentá de nuevo.
    </p>
    <Button variant="outline" onClick={onRetry}>
      Reintentar
    </Button>
  </div>
)

export { ContenidoErrorState }
export type { ContenidoErrorStateProps }
