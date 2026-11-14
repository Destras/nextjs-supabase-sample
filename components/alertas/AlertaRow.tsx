import { Check } from 'lucide-react'
import type { Alerta } from '@/app/controllers/Alerta'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AlertaTipoIcon } from './AlertaTipoIcon'

interface AlertaRowProps {
  readonly alerta: Alerta
  // Presente en el inbox del terapeuta (marcable); ausente en el drill-down
  // admin read-only (`/terapeutas/[id]`) — el check se muestra solo si hay
  // `onMarcar`, así la misma fila sirve para ambos.
  readonly onMarcar?: (alerta: Alerta) => void
  readonly isMarcando?: boolean
  // `alerta` viaja junto al id para que el destino pueda variar por tipo —
  // hoy solo `medicion_cierre_pendiente` lo usa, para deep-linkear al diálogo
  // de finalización en vez del tab "Camino" (DEC-32/T5.1).
  readonly onOpenPaciente: (pacienteId: string, alerta: Alerta) => void
}

// Molécula compartida `alert-row` del mock (pages-1.jsx:283-300 ·
// styles.css:676-721): icon + who/what + el check "marcar atendida" (solo
// cuando hay `onMarcar`). Se omite el `when`/fecha del mock por decisión de
// producto (2026-07-06). Fila clickeable → onOpenPaciente. La prioridad la
// comunica SOLO el ícono (AlertaTipoIcon) — la fila nunca se tiñe entera.
const AlertaRow = ({
  alerta,
  onMarcar,
  isMarcando,
  onOpenPaciente,
}: AlertaRowProps) => {
  return (
    <div
      className={cn(
        'group relative grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-3.5 border-b border-border py-3.5 transition-colors last:border-b-0',
        'hover:bg-muted/30',
      )}
    >
      <AlertaTipoIcon icono={alerta.icono} prioridad={alerta.prioridad} />
      {/* Botón real (foco/teclado) cuyo overlay `after:inset-0` estira el área
          clickeable a toda la fila (patrón stretched-link) sin anidar el check
          adentro: así la fila abre el paciente con mouse Y con Tab+Enter/Espacio,
          y el check queda como hermano (nunca button-dentro-de-button). */}
      <button
        type="button"
        onClick={() => onOpenPaciente(alerta.pacienteId, alerta)}
        className="min-w-0 rounded-sm text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block text-sm font-medium text-foreground">
          {alerta.pacienteNombre}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {alerta.mensaje}
        </span>
      </button>
      {onMarcar && alerta.descartable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative z-10 size-7 text-muted-foreground opacity-70 transition-opacity hover:text-foreground group-hover:opacity-100"
              disabled={isMarcando}
              aria-label="Marcar atendida"
              // z-10 lo mantiene por encima del overlay `after` del botón de la
              // fila; stopPropagation impide que marcar dispare la navegación.
              onClick={(e) => {
                e.stopPropagation()
                onMarcar(alerta)
              }}
            >
              <Check className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Marcar atendida</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export { AlertaRow }
export type { AlertaRowProps }
