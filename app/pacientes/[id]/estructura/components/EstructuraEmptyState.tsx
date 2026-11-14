import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface EstructuraEmptyStateProps {
  readonly puedeMedir: boolean
  readonly onRegistrar: () => void
}

// "El punto de partida" (DevSpec §7.2 títulos de card) — etapa iniciada sin
// ninguna medición todavía. Sin ejes vacíos (no Sparkline acá, ya que no hay
// datos que graficar).
const EstructuraEmptyState = ({
  puedeMedir,
  onRegistrar,
}: EstructuraEmptyStateProps) => (
  <Card>
    <CardHeader>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Estructura bioenergética
      </p>
      <h3 className="font-display text-2xl text-foreground">
        El <em className="not-italic text-primary">punto de partida</em>
      </h3>
    </CardHeader>
    <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Todavía no registraste ninguna medición de este paciente. La primera va
        a ser el punto de partida de su evolución.
      </p>
      {puedeMedir && (
        <Button type="button" onClick={onRegistrar}>
          Registrar primera medición
        </Button>
      )}
    </CardContent>
  </Card>
)

export { EstructuraEmptyState }
export type { EstructuraEmptyStateProps }
