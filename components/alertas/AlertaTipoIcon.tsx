import type { AlertaPrioridad } from '@/app/controllers/Alerta'
import { cn } from '@/lib/utils'

interface AlertaTipoIconProps {
  readonly icono: string
  readonly prioridad: AlertaPrioridad
}

// 1:1 con el mock (`.alert-icon`, styles.css:698-705): alta = coral
// (destructive-bg/destructive), media = gold. El token `--warning` ES el dorado
// del mock (#b87a18 / dark #e8b964, bg gold translúcido) — mapea exacto a
// `.alert-icon.med` (gold-300 sobre rgba gold). No es muted.
// `baja` (reinicio, feat/nuevo-tratamiento) no existía en el mock original —
// no es un problema a resolver sino un aviso positivo, así que colapsa al
// token semántico `info` (teal), ya usado en el proyecto para esta misma
// connotación (ver Badge `info` en app/layout.tsx y DiagnosticoStep.tsx).
const TONE_BY_PRIORIDAD: Record<AlertaPrioridad, string> = {
  alta: 'bg-destructive-bg text-destructive',
  media: 'bg-warning-bg text-warning',
  baja: 'bg-info-bg text-info',
}

// El glifo viene resuelto del catálogo `tipos_alerta.icono` (mapAlertaRow) —
// no hay `GLYPH_BY_TIPO` hardcodeado como en v1.
const AlertaTipoIcon = ({ icono, prioridad }: AlertaTipoIconProps) => {
  return (
    <div
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-sm',
        TONE_BY_PRIORIDAD[prioridad],
      )}
    >
      {icono}
    </div>
  )
}

export { AlertaTipoIcon }
export type { AlertaTipoIconProps }
