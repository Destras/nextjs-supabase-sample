import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { ContenidoTabViewModel } from './controllers'
import { ContenidoGrid } from './components/ContenidoGrid'
import { ContenidoEmptyState } from './components/ContenidoEmptyState'
import { ContenidoErrorState } from './components/ContenidoErrorState'
import { ContenidoLoadingState } from './components/ContenidoLoadingState'

const ContenidoView = ({
  pacienteId,
  isLoading,
  error,
  hasContent,
  weeks,
  refresh,
}: ContenidoTabViewModel) => {
  const asignarHref = `/asignar-contenido?paciente=${pacienteId}`

  if (isLoading) return <ContenidoLoadingState />
  if (error !== null) return <ContenidoErrorState onRetry={refresh} />
  if (!hasContent) return <ContenidoEmptyState pacienteId={pacienteId} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button asChild>
          <Link href={asignarHref}>Asignar / Editar plan</Link>
        </Button>
      </div>
      <ContenidoGrid weeks={weeks} />
    </div>
  )
}

export { ContenidoView }
