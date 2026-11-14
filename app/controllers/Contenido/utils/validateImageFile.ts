const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Duplicated client-side against the contenidos-imagenes bucket's own
// file_size_limit + allowed_mime_types (design §4.1/§5), so the admin gets an
// inline message instead of a raw Storage 413/415.
const ALLOWED_IMAGE_MIME: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

type ImageFileValidation =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly error: 'formato_invalido' | 'tamano_excedido'
    }

const validateImageFile = (file: File): ImageFileValidation => {
  if (!ALLOWED_IMAGE_MIME.includes(file.type))
    return { ok: false, error: 'formato_invalido' }
  if (file.size > MAX_IMAGE_BYTES)
    return { ok: false, error: 'tamano_excedido' }
  return { ok: true }
}

export type { ImageFileValidation }
export { validateImageFile, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME }
