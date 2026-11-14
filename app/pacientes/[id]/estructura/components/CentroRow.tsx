import { ChevronDown } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Delta } from '@/components/mediciones'
import { cn } from '@/lib/utils'

interface CentroRowProps {
  readonly nombre: string
  readonly valor: number
  readonly delta: number | null
  readonly abierto: boolean
  readonly onToggle: () => void
}

// `est-row` del mock (design §5.2, DevSpec §5): nombre · barra · valor% ·
// Delta · caret. La barra usa el atom shadcn `Progress` (§5.6 — un progress
// bar es un primitivo, no se hand-rolla). `min-h-11` = 44px (a11y, alto
// mínimo de fila táctil).
const CentroRow = ({
  nombre,
  valor,
  delta,
  abierto,
  onToggle,
}: CentroRowProps) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={abierto}
    className={cn(
      'grid min-h-11 w-full grid-cols-[minmax(120px,1.4fr)_minmax(60px,1.6fr)_54px_64px_18px] items-center gap-3.5 border-b border-border px-1.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50',
      abierto && 'bg-muted/50',
    )}
  >
    <span className="truncate text-foreground">{nombre}</span>
    <Progress value={valor} className="h-1" />
    <span className="text-right font-mono text-sm">{valor}%</span>
    <span className="text-right">
      <Delta value={delta} />
    </span>
    <ChevronDown
      className={cn(
        'size-4 justify-self-end text-muted-foreground transition-transform duration-200',
        abierto && 'rotate-180',
      )}
      aria-hidden="true"
    />
  </button>
)

export { CentroRow }
export type { CentroRowProps }
