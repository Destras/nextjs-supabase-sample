import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface MedicionNoticeProps {
  readonly tone: 'info' | 'error' | 'ok'
  readonly children: React.ReactNode
}

// Banner `est-notice` del mock (design §5.2, DevSpec §5): borde izquierdo de
// 3px, sin `sonner` en esta pestaña. A diferencia del mock (siempre
// `--gold-400`), acá cada tone resuelve a un token semántico DISTINTO que ya
// existe en globals.css (`--info`/`--destructive`/`--success`) — un match
// exacto, no una colisión que requiera colapsar.
const TONE_BORDER: Record<MedicionNoticeProps['tone'], string> = {
  info: 'border-l-info',
  error: 'border-l-destructive',
  ok: 'border-l-success',
}

const MedicionNotice = ({ tone, children }: MedicionNoticeProps) => (
  <Alert
    variant={tone === 'error' ? 'destructive' : 'default'}
    className={cn('border-l-[3px]', TONE_BORDER[tone])}
  >
    <AlertDescription className="text-sm leading-relaxed text-foreground">
      {children}
    </AlertDescription>
  </Alert>
)

export { MedicionNotice }
export type { MedicionNoticeProps }
