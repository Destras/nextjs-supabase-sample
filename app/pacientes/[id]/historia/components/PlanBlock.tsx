import type { EtapaHistoria } from '@/app/controllers/Tratamiento'

interface PlanBlockProps {
  readonly modalidad: EtapaHistoria['modalidad']
}

const PlanBlock = ({ modalidad }: PlanBlockProps) => {
  if (modalidad === null) {
    return (
      <section className="flex flex-col gap-4 px-4 py-4">
        <div className="eyebrow text-muted-foreground">Plan de tratamiento</div>
        <p className="text-sm italic text-muted-foreground">
          Sin modalidad de tratamiento registrada para esta etapa.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <div className="eyebrow text-muted-foreground">Plan de tratamiento</div>

      {/* Modalidad nombre */}
      <div className="flex flex-col gap-1">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Modalidad
        </div>
        <span className="text-sm font-medium text-foreground">
          {modalidad.nombre}
        </span>
      </div>

      {/* Niveles */}
      <div className="flex flex-col gap-1">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Niveles / semanas
        </div>
        <span className="text-sm text-foreground">
          {modalidad.cantidadNiveles} niveles
        </span>
      </div>

      {/* Duración estimada — omit if null */}
      {modalidad.duracionMesesEstimada !== null && (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Duración estimada
          </div>
          <span className="text-sm text-foreground">
            {modalidad.duracionMesesEstimada} meses
          </span>
        </div>
      )}
    </section>
  )
}

export { PlanBlock }
export type { PlanBlockProps }
