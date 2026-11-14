'use client'

import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { useContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'
import type { ContenidoTipoTabViewModel } from '@/app/contenido/controllers/useContenidoTipoTabViewModel'

const useVideosTabViewModel = (): ContenidoTipoTabViewModel => {
  return useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO)
}

export { useVideosTabViewModel }
