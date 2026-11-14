import { Video, AudioLines, Sparkles, Images, BrainCircuit } from 'lucide-react'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'

interface ContenidoTipoIconProps {
  readonly tipo: TIPO_CONTENIDO
}

// Sparkles/Images/BrainCircuit reuse the exact icon vocabulary design §9.3
// assigns to egregor/cma/ic on the plan grid, so the same tipo reads with the
// same icon everywhere in the console rather than bikeshedding a second set.
const ICON_MAP: Record<
  TIPO_CONTENIDO,
  { Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  [TIPO_CONTENIDO.VIDEO]: { Icon: Video, label: 'Meditación' },
  [TIPO_CONTENIDO.AUDIO]: { Icon: AudioLines, label: 'Mantra' },
  [TIPO_CONTENIDO.EGREGOR]: { Icon: Sparkles, label: 'Egregor' },
  [TIPO_CONTENIDO.CMA]: { Icon: Images, label: 'CMA' },
  [TIPO_CONTENIDO.IC]: { Icon: BrainCircuit, label: 'IC' },
}

const ContenidoTipoIcon = ({ tipo }: ContenidoTipoIconProps) => {
  const { Icon, label } = ICON_MAP[tipo]
  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 text-muted-foreground"
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

export { ContenidoTipoIcon }
export type { ContenidoTipoIconProps }
