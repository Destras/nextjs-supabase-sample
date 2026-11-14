'use client'

import { ContenidoListView } from '@/app/contenido/components/ContenidoListView'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers'

const IcView = (vm: ContenidoTipoTabViewModel) => (
  <ContenidoListView {...vm} tab="ic" />
)

export { IcView }
