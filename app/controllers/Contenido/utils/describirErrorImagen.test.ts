import type { DescripcionErrorImagen } from '../ContenidoTypes'
import { describirErrorImagen } from './describirErrorImagen'

describe('describirErrorImagen', () => {
  it('explains an oversized image and marks it as not retryable', () => {
    expect(
      describirErrorImagen('tamano_excedido'),
    ).toEqual<DescripcionErrorImagen>({
      mensaje: 'Supera los 5 MB. Quitala y subí una más liviana.',
      reintentable: false,
    })
  })

  it('explains an unsupported format and marks it as not retryable', () => {
    expect(
      describirErrorImagen('formato_invalido'),
    ).toEqual<DescripcionErrorImagen>({
      mensaje: 'Formato no admitido. Usá JPG, PNG, WebP o AVIF.',
      reintentable: false,
    })
  })

  it('explains a failed upload and marks it as retryable', () => {
    expect(
      describirErrorImagen('upload_failed'),
    ).toEqual<DescripcionErrorImagen>({
      mensaje: 'No pudimos subirla. Reintentá.',
      reintentable: true,
    })
  })
})
