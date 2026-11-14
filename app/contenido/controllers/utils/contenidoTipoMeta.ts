import type { TabKey } from '../catalogItem'

type ThumbKind = 'video' | 'mantra' | 'egregor' | 'galeria'

interface TipoMeta {
  readonly label: string
  readonly thumbKind: ThumbKind
  // Frase del diálogo de reemplazo cuando no queda otra pieza del mismo tipo.
  // Va escrita entera por tipo: el género y el nombre no se derivan de la clave.
  readonly sinReemplazo: string
  // Media types carry a duration; gallery types (CMA/IC) do not.
  readonly tieneDuracion: boolean
}

// `Map` y no objeto literal: indexar un objeto con una clave que no es un tipo
// recorre `Object.prototype` y devuelve basura tipada como TipoMeta.
const META: ReadonlyMap<TabKey, TipoMeta> = new Map<TabKey, TipoMeta>([
  [
    'videos',
    {
      label: 'Meditaciones en video',
      thumbKind: 'video',
      sinReemplazo: 'No hay otra meditación para reemplazarla.',
      tieneDuracion: true,
    },
  ],
  [
    'mantras',
    {
      label: 'Mantra',
      thumbKind: 'mantra',
      sinReemplazo: 'No hay otro mantra para reemplazarlo.',
      tieneDuracion: true,
    },
  ],
  [
    'egregores',
    {
      label: 'Egregor',
      thumbKind: 'egregor',
      sinReemplazo: 'No hay otro egregor para reemplazarlo.',
      tieneDuracion: true,
    },
  ],
  [
    'cma',
    {
      label: 'CMA',
      thumbKind: 'galeria',
      sinReemplazo: 'No hay otro CMA para reemplazarlo.',
      tieneDuracion: false,
    },
  ],
  [
    'ic',
    {
      label: 'IC',
      thumbKind: 'galeria',
      sinReemplazo: 'No hay otra IC para reemplazarla.',
      tieneDuracion: false,
    },
  ],
])

const META_GENERICA: TipoMeta = {
  label: 'Contenido',
  thumbKind: 'galeria',
  sinReemplazo: 'No hay otro contenido para reemplazarlo.',
  tieneDuracion: false,
}

const contenidoTipoMeta = (tab: TabKey): TipoMeta =>
  META.get(tab) ?? META_GENERICA

export type { ThumbKind, TipoMeta }
export { contenidoTipoMeta }
