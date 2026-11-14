import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { MedicionNotice } from './MedicionNotice'

interface EstructuraErrorStateProps {
  readonly onRetry: () => void
}

// "No pudimos cargar" (DevSpec §7.2 "Error de carga" + "Títulos de card") —
// layout del mock (`demo === 'error'`): kicker + título, el mensaje dentro del
// banner `est-notice-error` (MedicionNotice tone="error") y "Reintentar"
// alineado a la izquierda debajo.
const EstructuraErrorState = ({ onRetry }: EstructuraErrorStateProps) => (
  <Card>
    <CardHeader>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Estructura bioenergética
      </p>
      <h3 className="font-display text-2xl text-foreground">
        No pudimos <em className="italic">cargar</em>
      </h3>
    </CardHeader>
    <CardContent className="flex flex-col items-start gap-3.5">
      <MedicionNotice tone="error">
        No pudimos cargar las mediciones de este paciente. Probá de nuevo en un
        momento.
      </MedicionNotice>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </CardContent>
  </Card>
)

export { EstructuraErrorState }
export type { EstructuraErrorStateProps }
