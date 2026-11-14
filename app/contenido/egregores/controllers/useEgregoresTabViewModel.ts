'use client'

import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'

const useEgregoresTabViewModel = (): ContenidoTipoTabViewModel => {
  return useContenidoTipoTabViewModel(TIPO_CONTENIDO.EGREGOR)
}

export { useEgregoresTabViewModel }
