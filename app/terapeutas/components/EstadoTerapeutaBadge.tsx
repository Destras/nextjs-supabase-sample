import { Badge } from '@/components/ui/badge'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'

interface EstadoTerapeutaBadgeProps {
  readonly estado: TERAPEUTA_STATE
}

const ESTADO_LABEL: Record<TERAPEUTA_STATE, string> = {
  [TERAPEUTA_STATE.PENDIENTE]: 'Pendiente',
  [TERAPEUTA_STATE.ACTIVO]: 'Activo',
  [TERAPEUTA_STATE.INACTIVO]: 'Inactivo',
}

const EstadoTerapeutaBadge = ({ estado }: EstadoTerapeutaBadgeProps) => {
  if (estado === TERAPEUTA_STATE.ACTIVO) {
    return (
      <Badge className="border-success/30 bg-success-bg text-success">
        {ESTADO_LABEL[estado]}
      </Badge>
    )
  }
  if (estado === TERAPEUTA_STATE.PENDIENTE) {
    return (
      <Badge className="border-warning/30 bg-warning-bg text-warning">
        {ESTADO_LABEL[estado]}
      </Badge>
    )
  }
  return <Badge variant="secondary">{ESTADO_LABEL[estado]}</Badge>
}

export { EstadoTerapeutaBadge }
export type { EstadoTerapeutaBadgeProps }
