import { Skeleton } from '@/components/ui/skeleton'

const HeaderSkeleton = () => (
  <div className="mb-6 grid grid-cols-[auto_1fr] items-center gap-6 rounded-lg border border-border bg-card p-6">
    <Skeleton className="size-16 rounded-full" />
    <div className="space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
    </div>
  </div>
)

export { HeaderSkeleton }
