import { Skeleton } from '@/components/ui/skeleton'

// Fila fantasma con la misma grilla que `AlertaRow` (icono | who/what | when)
// para que el loading no "salte" al llegar la data real. Compartida por el
// inbox `/alertas` y el drill-down admin `/terapeutas/[id]`.
const AlertaRowSkeleton = () => (
  <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3.5 border-b border-border py-3.5 last:border-b-0">
    <Skeleton className="size-8 rounded-lg" />
    <div className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-3.5 w-56" />
    </div>
    <Skeleton className="h-3 w-8" />
  </div>
)

export { AlertaRowSkeleton }
