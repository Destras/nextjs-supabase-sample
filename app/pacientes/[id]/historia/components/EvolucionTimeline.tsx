'use client'

import { ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { EventoEvolucion } from '@/app/controllers/Tratamiento'
import type { Tendencia } from '@/app/controllers/Paciente'
import { Delta, MomentoChip } from '@/components/mediciones'
import { formatDate } from '@/lib/format'
import { ScorePill } from '../../../components/ScorePill'

interface EvolucionTimelineProps {
  readonly eventos: ReadonlyArray<EventoEvolucion>
}

const deriveTendencia = (deltaScore: number | null): Tendencia => {
  if (deltaScore === null || deltaScore === 0) return 'flat'
  return deltaScore > 0 ? 'up' : 'down'
}

const EvolucionTimeline = ({ eventos }: EvolucionTimelineProps) => {
  const params = useParams<{ id: string }>()

  if (eventos.length === 0) {
    return (
      <p className="py-6 text-sm italic text-muted-foreground">
        Sin evolución registrada todavía.
      </p>
    )
  }

  return (
    <div className="relative pl-5">
      {/* Vertical timeline line */}
      <div className="absolute bottom-1.5 left-[5px] top-1.5 w-px bg-border" />

      {eventos.map((evento, i) => {
        const isLast = i === eventos.length - 1

        if (evento.tipo === 'nivel') {
          return (
            <div
              key={`nivel-${evento.fecha}-${evento.numeroNivel}`}
              className={isLast ? 'relative' : 'relative pb-4'}
            >
              {/* Dot marker — nivel (accent gold) */}
              <div className="absolute -left-[13px] top-[5px] h-2.5 w-2.5 rounded-full border-[1.5px] border-brand-accent-500 bg-brand-accent-500" />

              <div className="flex flex-wrap items-baseline gap-2">
                {/* Date */}
                <span className="min-w-[48px] font-mono text-[11px] text-muted-foreground">
                  {formatDate(evento.fecha)}
                </span>

                {/* Level label */}
                <span className="text-sm font-medium text-foreground">
                  Nivel {evento.numeroNivel}
                </span>

                {/* Score or pending */}
                {evento.score !== null ? (
                  <ScorePill
                    score={evento.score}
                    tendencia={deriveTendencia(evento.deltaScore)}
                  />
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    pendiente
                  </span>
                )}
              </div>
            </div>
          )
        }

        if (evento.tipo === 'cambio_terapeuta') {
          return (
            <div
              key={`cambio-${evento.fecha}`}
              className={isLast ? 'relative' : 'relative pb-4'}
            >
              {/* Dot marker — cambio_terapeuta (secondary violet) */}
              <div className="absolute -left-[13px] top-[5px] h-2.5 w-2.5 rounded-full border-[1.5px] border-brand-secondary-300 bg-brand-secondary-300" />

              <div className="flex flex-wrap items-baseline gap-2">
                {/* Date */}
                <span className="min-w-[48px] font-mono text-[11px] text-muted-foreground">
                  {formatDate(evento.fecha)}
                </span>

                {/* Icon + label (accessibility: icon + text, not only color) */}
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary-300">
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  Cambio terapeuta:
                </span>

                <span className="text-sm text-foreground">
                  {evento.de} → {evento.a}
                </span>

                {evento.motivo !== null && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {evento.motivo}
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        }

        // tipo: 'medicion' (medir-chakras/PR5, design §5.5) — resumen, no
        // detalle por centro inline (RF-MED-033): eso vive en la matriz ④
        // (HistMediciones). El link navega al detalle en la pestaña
        // Estructura, resaltando la medición vía `?medicion=`.
        return (
          <div
            key={`medicion-${evento.medicionId}`}
            className={isLast ? 'relative' : 'relative pb-4'}
          >
            {/* Dot marker — medicion (accent gold, same as nivel) */}
            <div className="absolute -left-[13px] top-[5px] h-2.5 w-2.5 rounded-full border-[1.5px] border-brand-accent-500 bg-brand-accent-500" />

            <div className="flex flex-wrap items-baseline gap-2">
              {/* Date */}
              <span className="min-w-[48px] font-mono text-[11px] text-muted-foreground">
                {formatDate(evento.fecha)}
              </span>

              <span className="text-sm font-medium text-foreground">
                Medición de estructura
              </span>

              <MomentoChip momento={evento.momento} />

              <span className="font-mono text-sm">
                {evento.estructuraGeneral}%
              </span>
              <Delta value={evento.deltaEstructura} />

              <Link
                href={`/pacientes/${params.id}/estructura?medicion=${evento.medicionId}`}
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver detalle
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { EvolucionTimeline }
export type { EvolucionTimelineProps }
