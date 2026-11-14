import type { DescripcionErrorImagen, ErrorImagen } from '../ContenidoTypes'

const UPLOAD_FAILED: DescripcionErrorImagen = {
  mensaje: 'No pudimos subirla. Reintentá.',
  reintentable: true,
}

const DESCRIPCIONES: ReadonlyMap<ErrorImagen, DescripcionErrorImagen> = new Map<
  ErrorImagen,
  DescripcionErrorImagen
>([
  [
    'tamano_excedido',
    {
      mensaje: 'Supera los 5 MB. Quitala y subí una más liviana.',
      reintentable: false,
    },
  ],
  [
    'formato_invalido',
    {
      mensaje: 'Formato no admitido. Usá JPG, PNG, WebP o AVIF.',
      reintentable: false,
    },
  ],
  ['upload_failed', UPLOAD_FAILED],
])

const describirErrorImagen = (error: ErrorImagen): DescripcionErrorImagen =>
  DESCRIPCIONES.get(error) ?? UPLOAD_FAILED

export { describirErrorImagen }
