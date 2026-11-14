import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Paciente } from '@/app/controllers/Paciente'
import { MES_LABEL, MES_SHORT_LABEL } from '@/lib/clinicalLabels'
import { SEMANAS_POR_MES } from '@/app/controllers/Tratamiento/utils/semanasDeTratamiento'
import { Button } from '@/components/ui/button'
import { AuroraCard } from '../../components/AuroraCard'
import { tituloSinEtapaAbierta } from '../../controllers/utils/encabezadoTratamiento'
import { Chip } from '../../../components/Chip'

interface TimelineCardProps {
  paciente: Paciente
}

type CasillaEstado = 'done' | 'now' | 'upcoming'

const TimelineCard = ({ paciente }: TimelineCardProps) => {
  const { sinIniciar } = paciente

  // Etapa activa incompleta o degenerada (sin meses/semanas) → estado vacío.
  // Para una etapa "sin iniciar" (creada pero sin fecha_inicio), mesActual y
  // semanaGlobal son null por diseño — eso NO es el caso vacío: la estructura
  // (mesesTotales/semanasTotales) ya existe desde el diagnóstico. Por eso ese
  // par de campos solo cuenta para el guard cuando !sinIniciar. Se descarta
  // además el caso degenerado cantidad_niveles = 0 (mesesTotales = 0), que no
  // debe renderizar una timeline "Mes 0/0".
  if (
    paciente.semanasTotales === null ||
    paciente.mesesTotales === null ||
    paciente.mesesTotales < 1 ||
    (!sinIniciar &&
      (paciente.semanaGlobal === null || paciente.mesActual === null))
  ) {
    return (
      <AuroraCard
        kicker="Vista del camino"
        title={tituloSinEtapaAbierta(paciente.inicioTratamiento.estado)}
      >
        <p className="italic text-muted-foreground">Aún sin etapa activa.</p>
      </AuroraCard>
    )
  }

  const total = paciente.semanasTotales
  const current = paciente.semanaGlobal // null cuando sinIniciar

  const mesActual = paciente.mesActual // null cuando sinIniciar
  const mesesTotales = paciente.mesesTotales

  // Semanas agrupadas por mes: cada mes agrupa SEMANAS_POR_MES (=4) semanas
  // — la misma fuente que semanasDeTratamiento (total = mesesTotales * 4). Espeja
  // la grilla del strip de meses para que 1 mes quede alineado con sus 4 semanas.
  const semanasPorMes = SEMANAS_POR_MES

  // Sin mesActual/current (sinIniciar) todo es 'upcoming' — la estructura es
  // real desde el diagnóstico, el progreso no: no hay mes ni semana "ahora".
  const mesEstado = (mes: number): CasillaEstado => {
    if (mesActual === null) return 'upcoming'
    if (mes < mesActual) return 'done'
    if (mes === mesActual) return 'now'
    return 'upcoming'
  }

  const semanaEstado = (week: number): CasillaEstado => {
    if (current === null) return 'upcoming'
    if (week < current) return 'done'
    if (week === current) return 'now'
    return 'upcoming'
  }

  const kicker = sinIniciar
    ? 'Sin iniciar'
    : `${MES_LABEL} ${mesActual ?? '—'}/${mesesTotales}`

  return (
    <AuroraCard
      kicker={kicker}
      title={
        <>
          {mesesTotales} meses ·{' '}
          <span className="font-semibold text-primary">vista del camino</span>
        </>
      }
    >
      {sinIniciar && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Chip tone="gold">Sin iniciar</Chip>
            <span>
              El tratamiento todavía no empezó. Podés iniciarlo ahora y armar el
              plan semana a semana.
            </span>
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/asignar-contenido?paciente=${paciente.id}`}>
              Armar el plan
            </Link>
          </Button>
        </div>
      )}

      {/* Month strip — eje principal del camino */}
      <div className="flex items-stretch gap-1 rounded-md bg-muted p-1">
        {Array.from({ length: mesesTotales }, (_, i) => {
          const mes = i + 1
          const mesState = mesEstado(mes)
          return (
            <div
              key={mes}
              className={cn(
                'flex h-9 flex-1 items-center justify-center rounded text-xs font-semibold',
                mesState === 'done' && 'bg-success-bg text-success',
                mesState === 'now' &&
                  'border border-brand-accent-500 bg-brand-accent-500/18 text-brand-accent-700',
                mesState === 'upcoming' && 'text-muted-foreground/70',
              )}
            >
              {MES_SHORT_LABEL} {mes}
            </div>
          )
        })}
      </div>

      {/* Week sub-strip — referencia secundaria, agrupada por mes (4 semanas c/u)
          para alinearse columna a columna con el strip de meses de arriba. */}
      <div className="mt-2 space-y-1 px-1">
        <div className="flex gap-1">
          {Array.from({ length: mesesTotales }, (_, mi) => (
            <div key={mi} className="flex flex-1 items-center gap-px">
              {Array.from({ length: semanasPorMes }, (_, wi) => {
                const week = mi * semanasPorMes + wi + 1
                const weekState = semanaEstado(week)
                return (
                  <div
                    key={week}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      weekState === 'done' && 'bg-success/40',
                      weekState === 'now' && 'bg-brand-accent-500',
                      weekState === 'upcoming' && 'bg-border',
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {current !== null ? `Semana ${current}/${total}` : `${total} semanas`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-success-bg" />
          <span>Completado</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-brand-accent-500 bg-brand-accent-500/18" />
          <span>{MES_SHORT_LABEL} actual</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-border" />
          <span>Próximo</span>
        </span>
      </div>
    </AuroraCard>
  )
}

export { TimelineCard }
export type { TimelineCardProps }
