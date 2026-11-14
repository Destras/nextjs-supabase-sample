import { Skeleton } from '@/components/ui/skeleton'

const CHAPTER_COUNT = 4

const HistoriaLoadingState = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: CHAPTER_COUNT }).map((_, i) => (
      <div key={i} className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
    ))}
  </div>
)

export { HistoriaLoadingState }
