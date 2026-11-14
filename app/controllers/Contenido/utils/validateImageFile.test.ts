import type { ImageFileValidation } from './validateImageFile'
import { validateImageFile, MAX_IMAGE_BYTES } from './validateImageFile'

const sized = (file: File, value: number): File => {
  Object.defineProperty(file, 'size', { value, configurable: true })
  return file
}

describe('validateImageFile', () => {
  it('returns ok:true for a JPEG within the size limit', () => {
    const file = sized(new File([''], 'a.jpg', { type: 'image/jpeg' }), 1024)
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({ ok: true })
  })

  it('returns ok:true for a PNG within the size limit', () => {
    const file = sized(new File([''], 'a.png', { type: 'image/png' }), 1024)
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({ ok: true })
  })

  it('returns ok:true for a WEBP within the size limit', () => {
    const file = sized(new File([''], 'a.webp', { type: 'image/webp' }), 1024)
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({ ok: true })
  })

  it('returns ok:true for an AVIF within the size limit', () => {
    const file = sized(new File([''], 'a.avif', { type: 'image/avif' }), 1024)
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({ ok: true })
  })

  it('returns formato_invalido for a disallowed MIME type', () => {
    const file = sized(
      new File([''], 'a.pdf', { type: 'application/pdf' }),
      1024,
    )
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns tamano_excedido for a file that exceeds MAX_IMAGE_BYTES', () => {
    const file = sized(
      new File([''], 'a.jpg', { type: 'image/jpeg' }),
      MAX_IMAGE_BYTES + 1,
    )
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({
      ok: false,
      error: 'tamano_excedido',
    })
  })

  it('returns ok:true for a file exactly at MAX_IMAGE_BYTES', () => {
    const file = sized(
      new File([''], 'a.jpg', { type: 'image/jpeg' }),
      MAX_IMAGE_BYTES,
    )
    expect(validateImageFile(file)).toEqual<ImageFileValidation>({ ok: true })
  })
})
