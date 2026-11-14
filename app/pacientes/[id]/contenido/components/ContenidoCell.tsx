import Link from 'next/link'
import { ContenidoTipoIcon } from './ContenidoTipoIcon'
import type { ContenidoCellData } from '../controllers'

interface ContenidoCellProps {
  readonly cell: ContenidoCellData | null
}

const ContenidoCell = ({ cell }: ContenidoCellProps) => {
  if (cell === null) {
    return (
      <span
        className="text-muted-foreground"
        aria-label="Sin contenido asignado"
      >
        —
      </span>
    )
  }

  // Título en hasta dos líneas (la columna tiene ancho repartido, no fijo); el
  // nombre completo queda en `title` para verlo al pasar el mouse.
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 inline-flex shrink-0">
        <ContenidoTipoIcon tipo={cell.tipo} />
      </span>
      <Link
        href={`/contenido/${cell.id}`}
        title={cell.titulo}
        className="line-clamp-2 min-w-0 break-words text-sm text-foreground underline-offset-4 hover:underline"
      >
        {cell.titulo}
      </Link>
    </div>
  )
}

export { ContenidoCell }
export type { ContenidoCellProps }
