import { Skeleton } from '@/components/ui/skeleton'

// El mock no define un loading state explícito (delta consciente): skeleton de
// los 4 hero-stats + el bloque principal, con la misma grilla del dashboard.
const DashboardLoadingState = () => {
  return (
    <main className="flex min-h-dvh flex-col gap-6 p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </main>
  )
}

export { DashboardLoadingState }
