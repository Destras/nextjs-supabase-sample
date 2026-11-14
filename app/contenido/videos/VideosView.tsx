'use client'

import { ContenidoListView } from '@/app/contenido/components/ContenidoListView'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers'

const VideosView = (vm: ContenidoTipoTabViewModel) => (
  <ContenidoListView {...vm} tab="videos" />
)

export { VideosView }
