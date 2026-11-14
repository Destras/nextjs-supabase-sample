'use client'

import { ContenidoListView } from '@/app/contenido/components/ContenidoListView'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers'

const CmaView = (vm: ContenidoTipoTabViewModel) => (
  <ContenidoListView {...vm} tab="cma" />
)

export { CmaView }
