import type { EtapaHistoria } from '@/app/controllers/Tratamiento'
import { EtapaStatus, isEtapaCerrada } from '@/app/controllers/Tratamiento'
import type { Tendencia } from '@/app/controllers/Paciente'
import { formatDate } from '@/lib/format'
import { ScorePill } from '../../../components/ScorePill'

interface ResultadoBlockProps {
  readonly etapa: EtapaHistoria
}

const deriveTendencia = (delta: number): Tendencia => {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

const ResultadoBlock = ({ etapa }: ResultadoBlockProps) => {
  const isClosed = isEtapaCerrada(etapa.status)

  return (
    <section className="flex flex-col gap-4 px-4 py-4">
      <div className="eyebrow text-muted-foreground">
        {isClosed ? 'Resultado' : 'Próxima evaluación'}
      </div>

      {isClosed ? (
        /* Closed stage: expanded result line */
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-foreground">
          {/* Status */}
          <span className="font-medium">
            {etapa.status === EtapaStatus.FINALIZADA
              ? 'Finalizada'
              : 'Abandonada'}
          </span>

          {/* Duration */}
          {etapa.duracionMeses !== null && (
            <>
              <span className="text-muted-foreground">·</span>
              <span>{etapa.duracionMeses} meses</span>
            </>
          )}

          {/* Delta score with ScorePill */}
          {etapa.deltaScoreEtapa !== null && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">score</span>
              <span>{etapa.deltaScoreEtapa.primero}</span>
              <span className="text-muted-foreground">→</span>
              <span>{etapa.deltaScoreEtapa.ultimo}</span>
              <ScorePill
                score={
                  etapa.deltaScoreEtapa.ultimo - etapa.deltaScoreEtapa.primero
                }
                tendencia={deriveTendencia(
                  etapa.deltaScoreEtapa.ultimo - etapa.deltaScoreEtapa.primero,
                )}
              />
            </>
          )}

          {/* Motivo cierre */}
          {etapa.motivoCierre !== null && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {etapa.motivoCierre}
              </span>
            </>
          )}
        </div>
      ) : (
        /* En curso: próxima evaluación */
        <div className="text-sm">
          {etapa.proximaEvaluacion !== null ? (
            <span className="text-foreground">
              Próxima evaluación:{' '}
              <span className="font-medium">
                {formatDate(etapa.proximaEvaluacion)}
              </span>
            </span>
          ) : (
            <span className="italic text-muted-foreground">
              Próxima evaluación no agendada aún.
            </span>
          )}
        </div>
      )}
    </section>
  )
}

export { ResultadoBlock }
export type { ResultadoBlockProps }
