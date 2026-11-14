import { Skeleton } from '@/components/ui/skeleton'

const EvaluacionesLoadingState = () => (
  <div className="flex flex-col gap-6">
    <div className="flex h-64 items-end gap-4 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-12" />
      ))}
    </div>
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  </div>
)

export { EvaluacionesLoadingState }
