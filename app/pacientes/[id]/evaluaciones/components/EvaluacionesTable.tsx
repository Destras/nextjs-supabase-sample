import { AlertTriangle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { isLowScore } from '@/app/utils/score'
import { MES_SHORT_LABEL } from '@/lib/clinicalLabels'
import type { CompletedEvaluacionRow } from '../controllers'

interface EvaluacionesTableProps {
  readonly rows: ReadonlyArray<CompletedEvaluacionRow>
}

const formatVariation = (variation: number | 'baseline'): string => {
  if (variation === 'baseline') return 'punto de partida'
  // DEC-13/14: 1 decimal signed; delta = 0 → "0.0" sin signo
  const abs = Math.abs(variation).toFixed(1)
  if (variation > 0) return `+${abs}`
  if (variation < 0) return `-${abs}`
  return '0.0'
}

const EvaluacionesTable = ({ rows }: EvaluacionesTableProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Fecha</TableHead>
        <TableHead>{MES_SHORT_LABEL}</TableHead>
        <TableHead>Score</TableHead>
        <TableHead>Variación</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => {
        const low = isLowScore(row.score)
        return (
          <TableRow
            key={row.nivelId}
            className={cn(low && 'bg-destructive-bg')}
          >
            <TableCell className="font-mono text-muted-foreground">
              {formatDate(row.fechaRespuesta)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {MES_SHORT_LABEL} {row.numeroNivel}
              </Badge>
            </TableCell>
            <TableCell>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  low && 'text-destructive',
                )}
              >
                {row.score.toFixed(1)}
                {low ? (
                  <span aria-label="Score por debajo del umbral">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="font-mono text-muted-foreground tabular-nums">
              {formatVariation(row.variation)}
            </TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  </Table>
)

export { EvaluacionesTable }
export type { EvaluacionesTableProps }
