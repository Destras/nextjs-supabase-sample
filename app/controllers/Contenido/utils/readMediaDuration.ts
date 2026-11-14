// Reads a media file's duration (whole seconds) via an off-DOM media element.
// Uses an <audio> element for audio files and <video> for everything else
// (CON-014 — a <video> element is unreliable for some audio containers). The
// read is best-effort: it never rejects and resolves null on error, on a
// non-finite duration, or if metadata never arrives within the timeout (so the
// object URL is always revoked and the promise always settles — no leak/hang).
// 60 s, not 15 s: reading a duration can require walking the whole file (a
// non-faststart MP4 keeps its `moov` atom at the end), and with the 2 GB upload
// ceiling gone the multi-GB egregores this enables are exactly the slowest
// case. Nothing waits on this timer — the read runs alongside an upload that
// takes minutes — so a longer ceiling costs nobody anything and stops long
// videos from silently landing without a duration.
const METADATA_TIMEOUT_MS = 60000

const readMediaDuration = (file: File): Promise<number | null> =>
  new Promise((resolve) => {
    const tag = file.type.startsWith('audio/') ? 'audio' : 'video'
    const el = document.createElement(tag) as HTMLMediaElement
    const objectUrl = URL.createObjectURL(file)
    let settled = false

    const finish = (value: number | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(objectUrl)
      resolve(value)
    }

    const timer = setTimeout(() => finish(null), METADATA_TIMEOUT_MS)

    el.src = objectUrl
    el.onloadedmetadata = () => {
      const { duration } = el
      finish(
        !isFinite(duration) || isNaN(duration) ? null : Math.round(duration),
      )
    }
    el.onerror = () => finish(null)
  })

export { readMediaDuration }
