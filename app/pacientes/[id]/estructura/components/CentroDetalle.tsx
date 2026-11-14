import { Delta, MomentoChip, Sparkline } from '@/components/mediciones'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CentroHistorico } from '../controllers'

interface CentroDetalleProps {
  readonly historico: CentroHistorico
}

// Expansión inline bajo la fila (design §5.2, mock `d4c5ab46-…js:114-161`).
// A diferencia del mock (histórico de la etapa actual), acá `historico` ya
// viene agrupado por TODAS las etapas del paciente (§9.9 — sin selector de
// etapa) desde `mapCentroHistorico`. `momento` se muestra vía `MomentoChip`
// aunque el mock no lo hace acá — el dato ya viaja en el tipo y enriquece la
// lectura sin costo (delta consciente vs. mock, documentado en el reporte
// de /aurora-ui).
const CentroDetalle = ({ historico }: CentroDetalleProps) => {
  const totalMediciones = historico.etapas.reduce(
    (acc, etapa) => acc + etapa.mediciones.length,
    0,
  )

  return (
    <div className="my-0.5 flex flex-wrap gap-5 rounded-md border border-border bg-muted/40 p-4">
      <div className="min-w-[200px] flex-1">
        <Sparkline
          values={historico.valoresPlanos}
          separadores={historico.separadores}
          height={56}
        />
      </div>
      <div className="min-w-[240px] flex-[2]">
        {historico.etapas.map((grupo) => (
          <div key={grupo.etapaLabel} className="mb-3 last:mb-0">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {grupo.etapaLabel}
            </p>
            {grupo.mediciones.map((medicion, i) => (
              <div
                key={medicion.fecha}
                className={cn(
                  'flex items-baseline gap-3 py-1.5',
                  i > 0 && 'border-t border-border',
                )}
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDate(medicion.fecha)}
                </span>
                <MomentoChip momento={medicion.momento} />
                <span className="font-mono text-sm">{medicion.valor}%</span>
                <span className="ml-auto">
                  <Delta value={medicion.delta} />
                </span>
              </div>
            ))}
          </div>
        ))}
        {totalMediciones === 1 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Una sola medición: todavía no hay variación para mostrar.
          </p>
        )}
      </div>
    </div>
  )
}

export { CentroDetalle }
export type { CentroDetalleProps }
