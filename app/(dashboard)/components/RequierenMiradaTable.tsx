'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserAvatar } from '@/components/user-avatar'
import { Chip } from '@/app/pacientes/components/Chip'
import { ScorePill } from '@/app/pacientes/components/ScorePill'
import { isCriticalScore } from '@/app/utils/score'
import { cn } from '@/lib/utils'
import { ETAPA_LABEL, MES_LABEL, MES_SHORT_LABEL } from '@/lib/clinicalLabels'
import type { PacienteFila } from '../controllers/dashboardTypes'
import { DashboardCard } from './DashboardCard'
import { TierBEmptyState } from './TierBEmptyState'

interface RequierenMiradaTableProps {
  readonly pacientes: ReadonlyArray<PacienteFila>
  readonly hasEvaluaciones: boolean
}

// Card "Requieren tu mirada" (T5). Filas clickeables → /pacientes/[id]/camino;
// fila resaltada solo si el score es crítico (≤1, DEC-3) — el ScorePill ya
// rojea todo ≤3, el tinte de fila se reserva para lo verdaderamente urgente.
// Tier B: empty state hasta que haya scores.
const RequierenMiradaTable = ({
  pacientes,
  hasEvaluaciones,
}: RequierenMiradaTableProps) => {
  const router = useRouter()

  return (
    <DashboardCard kicker="Mis pacientes" title="Requieren tu mirada">
      {!hasEvaluaciones ? (
        <TierBEmptyState />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>{`${ETAPA_LABEL} · ${MES_LABEL}`}</TableHead>
              <TableHead>Causa</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pacientes.map((p) => (
              <TableRow
                key={p.id}
                onClick={() => router.push(`/pacientes/${p.id}/camino`)}
                className={cn(
                  'cursor-pointer',
                  isCriticalScore(p.ultimoScore) &&
                    'bg-destructive-bg/40 hover:bg-destructive-bg/60',
                )}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={p.nombre} size="md" />
                    <div>
                      <div className="font-medium">{p.nombre}</div>
                      {p.modalidadResumen && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {p.modalidadResumen}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {p.etapaOrdinal !== null &&
                  p.mesActual !== null &&
                  p.mesesTotales !== null ? (
                    <Chip tone="violet">
                      {ETAPA_LABEL} {p.etapaOrdinal} · {MES_SHORT_LABEL}{' '}
                      {p.mesActual}/{p.mesesTotales}
                    </Chip>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.causaActual?.nombre ?? '—'}
                </TableCell>
                <TableCell>
                  {p.ultimoScore !== null ? (
                    <ScorePill score={p.ultimoScore} tendencia={p.tendencia} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DashboardCard>
  )
}

export { RequierenMiradaTable }
export type { RequierenMiradaTableProps }
