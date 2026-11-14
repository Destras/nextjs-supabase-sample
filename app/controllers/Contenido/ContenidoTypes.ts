enum TIPO_CONTENIDO {
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  EGREGOR = 'EGREGOR',
  CMA = 'CMA',
  IC = 'IC',
}

interface ContenidoMetadata {
  readonly id: string
  readonly titulo: string | null
  readonly descripcion: string | null
}

interface MediaContent {
  readonly recursoRef: string | null
  readonly duracion: number | null
}

// One image of a gallery (tipo CMA/IC), sourced from `contenido_imagenes`.
// `orden` is server-derived (see create_contenido_galeria) — never client-set.
interface ContenidoImagen {
  readonly path: string
  readonly orden: number
}

type Contenido = ContenidoMetadata & {
  readonly tipo:
    | TIPO_CONTENIDO.VIDEO
    | TIPO_CONTENIDO.AUDIO
    | TIPO_CONTENIDO.EGREGOR
    | TIPO_CONTENIDO.CMA
    | TIPO_CONTENIDO.IC
  readonly contenido: MediaContent
  // Ordered gallery images (orden ascending). Always [] for non-gallery tipos.
  readonly imagenes: ReadonlyArray<ContenidoImagen>
}

// Every reason a gallery image can end up in `status: 'error'`: the two
// pre-upload rejections of validateImageFile plus a failed Storage upload.
type ErrorImagen = 'formato_invalido' | 'tamano_excedido' | 'upload_failed'

interface DescripcionErrorImagen {
  readonly mensaje: string
  // Only a failed upload can succeed on a second attempt — a rejected file is
  // the same file next time, so offering a retry would just fail again.
  readonly reintentable: boolean
}

export type {
  Contenido,
  ContenidoMetadata,
  MediaContent,
  ContenidoImagen,
  ErrorImagen,
  DescripcionErrorImagen,
}
export { TIPO_CONTENIDO }
