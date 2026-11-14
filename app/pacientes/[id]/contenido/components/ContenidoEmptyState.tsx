import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ContenidoEmptyStateProps {
  readonly pacienteId: string
}

const ContenidoEmptyState = ({ pacienteId }: ContenidoEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <p className="text-muted-foreground">
      Este paciente todavía no tiene contenido asignado.
    </p>
    <Button asChild>
      <Link href={`/asignar-contenido?paciente=${pacienteId}`}>
        Asignar / Editar plan
      </Link>
    </Button>
  </div>
)

export { ContenidoEmptyState }
export type { ContenidoEmptyStateProps }
