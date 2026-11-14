import { Skeleton } from '@/components/ui/skeleton'

// Las mismas 7 columnas que ContenidoGrid: Semana + los 5 tipos de contenido +
// Frases (BETA-044). Si la tabla suma o saca una columna, cambia acá también.
const LOADING_ROWS = 4
const LOADING_CONTENT_COLS = 6

const ContenidoLoadingState = () => (
  <div className="flex flex-col gap-2">
    {/* Header row skeleton */}
    <div className="flex gap-4 px-4">
      <Skeleton className="h-5 w-10" />
      {Array.from({ length: LOADING_CONTENT_COLS }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton className="h-5 w-20 max-w-full" />
        </div>
      ))}
    </div>
    {/* Data rows skeleton */}
    {Array.from({ length: LOADING_ROWS }).map((_, i) => (
      <div key={i} className="flex gap-4 px-4">
        <Skeleton className="h-8 w-10" />
        {Array.from({ length: LOADING_CONTENT_COLS }).map((_, j) => (
          <Skeleton key={j} className="h-8 flex-1" />
        ))}
      </div>
    ))}
  </div>
)

export { ContenidoLoadingState }
