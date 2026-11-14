import { Badge } from '@/components/ui/badge'
import { EtapaStatus } from '@/app/controllers/Tratamiento'

interface StatusMeta {
  readonly label: string
  readonly className: string
}

const STATUS_META: Record<EtapaStatus, StatusMeta> = {
  [EtapaStatus.PENDIENTE]: {
    label: 'Sin iniciar',
    className:
      'bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted',
  },
  [EtapaStatus.EN_CURSO]: {
    label: 'En curso',
    className:
      'bg-primary/15 text-primary border-primary/30 hover:bg-primary/15',
  },
  [EtapaStatus.FINALIZADA]: {
    label: 'Finalizada',
    className:
      'bg-success-bg text-success border-success/30 hover:bg-success-bg',
  },
  [EtapaStatus.ABANDONADA]: {
    label: 'Abandonada',
    className:
      'bg-destructive-bg text-destructive border-destructive/30 hover:bg-destructive-bg',
  },
}

interface EstadoEtapaChipProps {
  readonly status: EtapaStatus
}

const EstadoEtapaChip = ({ status }: EstadoEtapaChipProps) => {
  const { label, className } = STATUS_META[status]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}

export { EstadoEtapaChip }
export type { EstadoEtapaChipProps }
