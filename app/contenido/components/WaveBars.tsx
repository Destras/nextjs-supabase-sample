import { waveBarHeights } from '@/app/contenido/controllers/utils/waveBarHeights'
import { cn } from '@/lib/utils'

interface WaveBarsProps {
  readonly count: number
  readonly seed: number
  readonly className?: string
}

/**
 * Decorative, static waveform. Renders one bar per deterministic height in
 * [0.18, 1] from `waveBarHeights`. Presentational only — no animation / lit state.
 */
export function WaveBars({ count, seed, className }: WaveBarsProps) {
  const heights = waveBarHeights(count, seed)

  return (
    <div className={cn('flex h-full w-full items-center gap-[2px]', className)}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="min-h-[3px] flex-1 rounded-[2px] bg-brand-accent-300 opacity-45"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  )
}
