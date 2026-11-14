import type { EvaluacionesTabViewModel } from './controllers'
import { EvolucionChart } from './components/EvolucionChart'
import { EvaluacionesTable } from './components/EvaluacionesTable'
import { EvaluacionesEmptyState } from './components/EvaluacionesEmptyState'
import { EvaluacionesErrorState } from './components/EvaluacionesErrorState'
import { EvaluacionesLoadingState } from './components/EvaluacionesLoadingState'
import { EtapaSinIniciarCard } from '../components/EtapaSinIniciarCard'

const EvaluacionesView = ({
  pacienteId,
  isLoading,
  error,
  chartSlots,
  completedEvaluations,
  hasActiveTreatment,
  hasStarted,
  refresh,
}: EvaluacionesTabViewModel) => {
  if (isLoading) return <EvaluacionesLoadingState />
  if (error !== null) return <EvaluacionesErrorState onRetry={refresh} />
  if (!hasActiveTreatment) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Este paciente todavía no tiene un tratamiento activo asignado.
      </div>
    )
  }
  // INI-002: la etapa existe (hasActiveTreatment) pero todavía no arrancó —
  // decirlo así en vez de negar que exista el tratamiento, coherente con el
  // header de la ficha y el tab Camino (mismo organismo, EtapaSinIniciarCard).
  if (!hasStarted) {
    return <EtapaSinIniciarCard pacienteId={pacienteId} />
  }
  return (
    <div className="flex flex-col gap-6">
      <EvolucionChart slots={chartSlots} />
      {completedEvaluations.length === 0 ? (
        <EvaluacionesEmptyState />
      ) : (
        <EvaluacionesTable rows={completedEvaluations} />
      )}
    </div>
  )
}

export { EvaluacionesView }
