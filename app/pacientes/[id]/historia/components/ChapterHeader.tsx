import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { formatFechaDia } from '@/app/utils/fechaDia'
import { EtapaStatus, isEtapaCerrada } from '@/app/controllers/Tratamiento'
import type { EtapaHistoria } from '@/app/controllers/Tratamiento'
import { EstadoEtapaChip } from './EstadoEtapaChip'

interface ChapterHeaderProps {
  readonly etapa: EtapaHistoria
  readonly open: boolean
}

const ChapterHeader = ({ etapa, open }: ChapterHeaderProps) => {
  const isClosed = isEtapaCerrada(etapa.status)

  // Line 2: date range
  const fechaFin = etapa.fechaFin ? formatFechaDia(etapa.fechaFin) : 'hoy'
  const dateRange =
    etapa.fechaInicio === null
      ? 'No iniciada'
      : `${formatFechaDia(etapa.fechaInicio)} – ${fechaFin}`

  // Line 2: responsables (omit if empty)
  const responsablesText =
    etapa.responsables.length > 0
      ? etapa.responsables.map((r) => r.nombre).join(', ')
      : null

  // Line 3 tokens (closed stages only)
  const resultTokens: string[] = []
  if (isClosed) {
    resultTokens.push(
      etapa.status === EtapaStatus.FINALIZADA ? 'Finalizada' : 'Abandonada',
    )
    if (etapa.duracionMeses !== null) {
      resultTokens.push(`${etapa.duracionMeses} meses`)
    }
    if (etapa.deltaScoreEtapa !== null) {
      resultTokens.push(
        `score ${etapa.deltaScoreEtapa.primero}→${etapa.deltaScoreEtapa.ultimo}`,
      )
    }
    if (etapa.motivoCierre !== null) {
      resultTokens.push(etapa.motivoCierre)
    }
  }

  return (
    <div className="w-full px-4 py-3 text-left">
      {/* Line 1: diagnosis + status chip + chevron */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {etapa.diagnostico.causa.nombre}
            <span className="text-muted-foreground"> · </span>
            {etapa.diagnostico.algoritmo.nombre}
          </span>
          <EstadoEtapaChip status={etapa.status} />
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </div>

      {/* Line 2: date range + responsables */}
      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{dateRange}</span>
        {responsablesText !== null && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>{responsablesText}</span>
          </>
        )}
      </div>

      {/* Line 3: result line (closed stages only) */}
      {isClosed && resultTokens.length > 0 && (
        <div className="mt-1 text-sm text-muted-foreground">
          {resultTokens.join(' · ')}
        </div>
      )}
    </div>
  )
}

export { ChapterHeader }
export type { ChapterHeaderProps }
