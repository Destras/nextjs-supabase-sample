import { cn } from '@/lib/utils'
import type { Tendencia } from '@/app/controllers/Paciente'
import { isLowScore } from '@/app/utils/score'

const TREND_ARROW: Record<Tendencia, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

const TREND_COLOR: Record<Tendencia, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
}

interface ScorePillProps {
  score: number
  tendencia: Tendencia
}

const ScorePill = ({ score, tendencia }: ScorePillProps) => {
  const low = isLowScore(score)
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 text-base font-medium tabular-nums',
        low ? 'text-destructive' : 'text-foreground',
      )}
    >
      <span>{score.toFixed(1)}</span>
      <span className={cn('font-mono text-[11px]', TREND_COLOR[tendencia])}>
        {TREND_ARROW[tendencia]}
      </span>
    </span>
  )
}

export { ScorePill }
export type { ScorePillProps }
