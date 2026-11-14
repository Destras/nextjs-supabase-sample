import type { CaminoTabViewModel } from './controllers'
import { TimelineCard } from './components/TimelineCard'
import { CausaRaizCard } from './components/CausaRaizCard'

const CaminoView = ({ paciente, isLoading, error }: CaminoTabViewModel) => {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Cargando…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }
  if (paciente === null) return null
  return (
    <div className="flex flex-col gap-6">
      <TimelineCard paciente={paciente} />
      <CausaRaizCard paciente={paciente} />
    </div>
  )
}

export { CaminoView }
