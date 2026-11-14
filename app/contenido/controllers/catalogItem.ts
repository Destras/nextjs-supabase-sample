import type { Contenido } from '@/app/controllers/Contenido'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'

type TabKey = 'videos' | 'mantras' | 'egregores' | 'cma' | 'ic'

interface CatalogItem {
  readonly id: string
  readonly source: 'contenido'
  readonly tab: TabKey
  readonly nombre: string
  readonly descripcion: string | null
  readonly isPlayable: false
  readonly duracionSeg: number | null
}

// Real mapping (PR2b) — each tipo has its own catalog route now. EGREGOR
// reuses the video upload pipeline (design §8.2) but still lists under its
// own tab; CMA/IC are gallery types with their own routes. Keep in sync with
// the identical Record in app/contenido/[id]/ContenidoDetailView.tsx's
// TAB_BY_TIPO, or the two derivations disagree for the same row (G1.3 gate
// finding from PR2a).
const TAB_BY_TIPO: Record<TIPO_CONTENIDO, TabKey> = {
  [TIPO_CONTENIDO.VIDEO]: 'videos',
  [TIPO_CONTENIDO.AUDIO]: 'mantras',
  [TIPO_CONTENIDO.EGREGOR]: 'egregores',
  [TIPO_CONTENIDO.CMA]: 'cma',
  [TIPO_CONTENIDO.IC]: 'ic',
}

const contenidoToCatalogItem = (c: Contenido): CatalogItem => {
  const nombre = c.titulo ?? ''
  const descripcion = c.descripcion
  const tab: TabKey = TAB_BY_TIPO[c.tipo]

  return {
    id: c.id,
    source: 'contenido',
    tab,
    nombre,
    descripcion,
    isPlayable: false,
    duracionSeg: c.contenido.duracion,
  }
}

export type { TabKey, CatalogItem }
export { contenidoToCatalogItem }
