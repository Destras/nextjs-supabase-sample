const MAX_AUDIO_BYTES = 100 * 1024 ** 2

// Browser-playable formats we accept per tab. We deliberately accept more than
// a single container (CON-005) but not "any video/audio" — only formats a
// native <video>/<audio> can realistically decode, so an uploaded asset can
// actually be shown back. Extend these lists if a new web-playable format
// needs supporting. The bucket keeps a wider net (video/*, audio/*) so it
// never blocks on a MIME variant; this allowlist is the precise client gate.
const PLAYABLE_VIDEO_MIME: readonly string[] = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]
const PLAYABLE_AUDIO_MIME: readonly string[] = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
  'audio/flac',
  'audio/x-flac',
]

type MediaFileValidation =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly error: 'formato_invalido' | 'audio_tamano_excedido'
    }

const validateMediaFile = (
  file: File,
  tipo: 'videos' | 'mantras' | 'egregores',
): MediaFileValidation => {
  // Video — and egregores, which reuse the pipeline verbatim (design §8.2) —
  // carries NO size cap. Egregores are long-form pieces and the old 2 GiB
  // ceiling rejected them outright; the `contenidos` bucket is deliberately
  // uncapped too (file_size_limit = null, migration 20260529154937), so the
  // client was the only thing standing in the way. Format is still gated:
  // being long does not make a file playable.
  if (tipo === 'videos' || tipo === 'egregores') {
    if (!PLAYABLE_VIDEO_MIME.includes(file.type))
      return { ok: false, error: 'formato_invalido' }
    return { ok: true }
  }

  // Audio keeps its cap: mantras are short by nature, so a 100 MB+ audio is a
  // mistake, not a use case.
  if (!PLAYABLE_AUDIO_MIME.includes(file.type))
    return { ok: false, error: 'formato_invalido' }
  // Audio-specific code on purpose: validateImageFile emits a plain
  // `tamano_excedido` of its own for gallery images, and video no longer has a
  // cap at all. A shared code here would be a trap for whoever next routes an
  // image error through the form's ERROR_COPY map.
  if (file.size > MAX_AUDIO_BYTES)
    return { ok: false, error: 'audio_tamano_excedido' }
  return { ok: true }
}

export type { MediaFileValidation }
export {
  validateMediaFile,
  MAX_AUDIO_BYTES,
  PLAYABLE_VIDEO_MIME,
  PLAYABLE_AUDIO_MIME,
}
