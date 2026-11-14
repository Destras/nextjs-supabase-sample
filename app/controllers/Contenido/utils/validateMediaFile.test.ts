import type { MediaFileValidation } from './validateMediaFile'
import { validateMediaFile, MAX_AUDIO_BYTES } from './validateMediaFile'

const sized = (file: File, value: number): File => {
  Object.defineProperty(file, 'size', { value, configurable: true })
  return file
}

const GIB = 1024 ** 3

describe('validateMediaFile', () => {
  // ── videos: playable containers, no size cap ──────────────────────────────
  //
  // Egregores are long-form videos (design §8.2 reuses this pipeline verbatim),
  // so the 2 GB ceiling had to go — Storage is uncapped too. Format is still
  // gated on the playable-container allowlist: being long does not make a file
  // playable.

  it('returns ok:true for an MP4', () => {
    const file = sized(new File([''], 'clip.mp4', { type: 'video/mp4' }), 1024)
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns ok:true for a WEBM video (playable format, not just MP4)', () => {
    const file = sized(
      new File([''], 'clip.webm', { type: 'video/webm' }),
      1024,
    )
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns ok:true for a MOV video (video/quicktime)', () => {
    const file = sized(
      new File([''], 'clip.mov', { type: 'video/quicktime' }),
      1024,
    )
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns formato_invalido for a non-playable video container (MKV) when tipo is videos', () => {
    const file = sized(
      new File([''], 'clip.mkv', { type: 'video/x-matroska' }),
      1024,
    )
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns formato_invalido for an audio file uploaded under the videos tab', () => {
    const file = sized(new File([''], 'song.mp3', { type: 'audio/mpeg' }), 1024)
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns formato_invalido for a non-media file uploaded under the videos tab', () => {
    const file = sized(
      new File([''], 'guia.pdf', { type: 'application/pdf' }),
      1024,
    )
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns formato_invalido for a file the browser reports with no MIME type', () => {
    const file = sized(new File([''], 'clip', { type: '' }), 1024)
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns ok:true for an 8 GiB video (no size cap on video)', () => {
    const file = sized(
      new File([''], 'largo.mp4', { type: 'video/mp4' }),
      8 * GIB,
    )
    expect(validateMediaFile(file, 'videos')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  // ── egregores: reuse the video pipeline verbatim (design §8.2) ─────────────

  it('returns ok:true for an MP4 under the egregores tab', () => {
    const file = sized(new File([''], 'clip.mp4', { type: 'video/mp4' }), 1024)
    expect(validateMediaFile(file, 'egregores')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns formato_invalido for an audio file uploaded under the egregores tab', () => {
    const file = sized(new File([''], 'song.mp3', { type: 'audio/mpeg' }), 1024)
    expect(validateMediaFile(file, 'egregores')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns ok:true for an 8 GiB egregor video (no size cap on egregores)', () => {
    const file = sized(
      new File([''], 'egregor-largo.mp4', { type: 'video/mp4' }),
      8 * GIB,
    )
    expect(validateMediaFile(file, 'egregores')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns formato_invalido for a non-playable container (MKV) under the egregores tab', () => {
    const file = sized(
      new File([''], 'egregor.mkv', { type: 'video/x-matroska' }),
      1024,
    )
    expect(validateMediaFile(file, 'egregores')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  // ── mantras: any browser-playable audio format ────────────────────────────

  it('returns ok:true for an MP3 within the size limit', () => {
    const file = sized(
      new File([''], 'mantra.mp3', { type: 'audio/mpeg' }),
      1024,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns ok:true for a WAV audio (playable format, not just MP3)', () => {
    const file = sized(
      new File([''], 'mantra.wav', { type: 'audio/wav' }),
      1024,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns ok:true for an OGG audio', () => {
    const file = sized(
      new File([''], 'mantra.ogg', { type: 'audio/ogg' }),
      1024,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns ok:true for an M4A audio (audio/mp4)', () => {
    const file = sized(
      new File([''], 'mantra.m4a', { type: 'audio/mp4' }),
      1024,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })

  it('returns formato_invalido for a non-playable audio format (MIDI) when tipo is mantras', () => {
    const file = sized(
      new File([''], 'mantra.mid', { type: 'audio/midi' }),
      1024,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns formato_invalido for a video file uploaded under the mantras tab', () => {
    const file = sized(new File([''], 'clip.mp4', { type: 'video/mp4' }), 1024)
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'formato_invalido',
    })
  })

  it('returns audio_tamano_excedido for an audio that exceeds MAX_AUDIO_BYTES', () => {
    const file = sized(
      new File([''], 'mantra.mp3', { type: 'audio/mpeg' }),
      MAX_AUDIO_BYTES + 1,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: false,
      error: 'audio_tamano_excedido',
    })
  })

  it('returns ok:true for an audio exactly at MAX_AUDIO_BYTES', () => {
    const file = sized(
      new File([''], 'mantra.mp3', { type: 'audio/mpeg' }),
      MAX_AUDIO_BYTES,
    )
    expect(validateMediaFile(file, 'mantras')).toEqual<MediaFileValidation>({
      ok: true,
    })
  })
})
