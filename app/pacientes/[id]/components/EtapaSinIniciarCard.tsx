import Link from 'next/link'
import { PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EtapaSinIniciarCardProps {
  readonly pacienteId: string
}

// Etapa activa creada pero sin `fecha_inicio` (paciente.sinIniciar) — DEC-6c:
// el reloj arranca con el contenido, no con el alta. Organismo compartido por
// el header (línea de estado en HeaderBlock) y la vista del camino
// (TimelineCard la renderiza en el lugar de la timeline hasta que haya
// contenido cargado). Sin mockup en Aurora para este estado (feature nuevo,
// escape hatch #1) — reusa el patrón de empty-state centrado ya usado en
// SinIniciarCard (dashboard) y AccessDeniedState.
const EtapaSinIniciarCard = ({ pacienteId }: EtapaSinIniciarCardProps) => (
  <Card>
    <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
      <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
      <h3 className="text-lg font-medium">Sin iniciar</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        El tratamiento todavía no empezó. Podés iniciarlo ahora y armar el plan
        semana a semana.
      </p>
      <Button asChild>
        <Link href={`/asignar-contenido?paciente=${pacienteId}`}>
          Armar el plan
        </Link>
      </Button>
    </CardContent>
  </Card>
)

export { EtapaSinIniciarCard }
export type { EtapaSinIniciarCardProps }
