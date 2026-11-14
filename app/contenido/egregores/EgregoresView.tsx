'use client'

import { ContenidoListView } from '@/app/contenido/components/ContenidoListView'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers'

const EgregoresView = (vm: ContenidoTipoTabViewModel) => (
  <ContenidoListView {...vm} tab="egregores" />
)

export { EgregoresView }
