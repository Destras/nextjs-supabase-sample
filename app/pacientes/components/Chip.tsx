import { cn } from '@/lib/utils'

type ChipTone = 'default' | 'gold' | 'teal' | 'violet' | 'coral' | 'green'

// Los tones brand usan Layer 1 (color fijo, no se adapta al tema): el text-*-700
// es legible sobre el bg translúcido en claro, pero queda oscuro-sobre-oscuro en
// dark → se le da la variante clara (-300) en dark. coral/green ya usan tokens
// semánticos que se adaptan solos.
const CHIP_TONE: Record<ChipTone, string> = {
  default: 'bg-muted text-foreground border-border',
  gold: 'bg-brand-accent-500/15 text-brand-accent-700 dark:text-brand-accent-300 border-brand-accent-500/30',
  teal: 'bg-brand-primary-500/15 text-brand-primary-700 dark:text-brand-primary-300 border-brand-primary-500/30',
  violet:
    'bg-brand-secondary-500/18 text-brand-secondary-700 dark:text-brand-secondary-300 border-brand-secondary-500/40',
  coral: 'bg-destructive-bg text-destructive border-destructive/30',
  green: 'bg-success-bg text-success border-success/30',
}

interface ChipProps {
  tone?: ChipTone
  withDot?: boolean
  children: React.ReactNode
}

const Chip = ({ tone = 'default', withDot = false, children }: ChipProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]',
      CHIP_TONE[tone],
    )}
  >
    {withDot && (
      <span className="inline-block size-1.5 rounded-full bg-current" />
    )}
    {children}
  </span>
)

export { Chip }
export type { ChipProps, ChipTone }
