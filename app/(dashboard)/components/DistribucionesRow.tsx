import type { DistItem } from '../controllers/dashboardTypes'
import { DistribucionCard } from './DistribucionCard'

interface DistribucionesRowProps {
  readonly distribucionEtapa: ReadonlyArray<DistItem>
  readonly distribucionMes: ReadonlyArray<DistItem>
  readonly distribucionMesSiguiente: ReadonlyArray<DistItem>
  readonly mesActualLabel: string
  readonly mesSiguienteLabel: string
}

// Fila de 3 cards de distribución (Tier A), compartida por igual entre el
// dashboard admin y el de terapeuta — ambas vistas renderizaban exactamente
// el mismo grid (mismos kickers, misma description, mismo kickerClassName
// dorado en la proyección). Extraído para evitar la "shotgun surgery" de
// tocar dos archivos ante un cambio de copy/kicker (code-review).
const DistribucionesRow = ({
  distribucionEtapa,
  distribucionMes,
  distribucionMesSiguiente,
  mesActualLabel,
  mesSiguienteLabel,
}: DistribucionesRowProps) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <DistribucionCard
        kicker="Distribución de pacientes"
        title="Por etapa"
        items={distribucionEtapa}
      />
      <DistribucionCard
        kicker={`Mes de tratamiento · ${mesActualLabel}`}
        title="Por mes"
        description="En qué mes de su tratamiento (1 a 4) está cada paciente."
        items={distribucionMes}
      />
      <DistribucionCard
        kicker={`Proyección · ${mesSiguienteLabel}`}
        kickerClassName="text-brand-accent-700 dark:text-brand-accent-500"
        title="Por mes"
        items={distribucionMesSiguiente}
      />
    </div>
  )
}

export { DistribucionesRow }
export type { DistribucionesRowProps }
