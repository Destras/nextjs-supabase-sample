import { Skeleton } from '@/components/ui/skeleton'

// `est-skel` del mock — mismo patrón de EvaluacionesLoadingState (skeleton
// gate, no animate-pulse a mano).
const EstructuraLoadingState = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-9 w-full" />
    <Skeleton className="h-9 w-full" />
    <Skeleton className="h-9 w-full" />
  </div>
)

export { EstructuraLoadingState }
