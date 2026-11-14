import { readMediaDuration } from './readMediaDuration'

// JSDOM does not implement URL.createObjectURL / revokeObjectURL — define stubs
global.URL.createObjectURL = jest.fn()
global.URL.revokeObjectURL = jest.fn()

describe('readMediaDuration', () => {
  let file: File
  let mockElement: {
    src: string
    duration: number
    onloadedmetadata: (() => void) | null
    onerror: (() => void) | null
  }

  beforeEach(() => {
    file = new File([''], 'clip.mp4', { type: 'video/mp4' })

    mockElement = {
      src: '',
      duration: 0,
      onloadedmetadata: null,
      onerror: null,
    }

    jest
      .spyOn(document, 'createElement')
      .mockReturnValue(mockElement as unknown as HTMLElement)
    ;(URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url')
    ;(URL.revokeObjectURL as jest.Mock).mockImplementation(() => undefined)
  })

  it('resolves with the duration in whole seconds when the browser reports a finite duration', async () => {
    const promise = readMediaDuration(file)
    mockElement.duration = 125.7
    mockElement.onloadedmetadata?.()
    expect(await promise).toBe(126)
  })

  it('resolves with null when the browser reports NaN as the duration', async () => {
    const promise = readMediaDuration(file)
    mockElement.duration = NaN
    mockElement.onloadedmetadata?.()
    expect(await promise).toBeNull()
  })

  it('resolves with null when the media element fires onerror', async () => {
    const promise = readMediaDuration(file)
    mockElement.onerror?.()
    expect(await promise).toBeNull()
  })

  it('creates an <audio> element for an audio file (CON-014)', async () => {
    const audio = new File([''], 'mantra.mp3', { type: 'audio/mpeg' })
    const promise = readMediaDuration(audio)
    mockElement.onloadedmetadata?.() // settle so the timeout clears
    await promise
    expect(document.createElement).toHaveBeenCalledWith('audio')
  })

  it('creates a <video> element for a video file (CON-014)', async () => {
    const promise = readMediaDuration(file)
    mockElement.onloadedmetadata?.()
    await promise
    expect(document.createElement).toHaveBeenCalledWith('video')
  })

  it('resolves null and revokes the object URL when metadata never arrives (CON-014)', async () => {
    jest.useFakeTimers()
    const promise = readMediaDuration(file)
    jest.advanceTimersByTime(70000)
    const result = await promise
    jest.useRealTimers()
    expect(result).toBeNull()
  })

  // Reading a long video's duration means the browser may have to walk the
  // whole file: a non-faststart MP4 keeps its `moov` atom at the end. With the
  // 2 GB upload ceiling gone, multi-GB egregores are exactly the files that
  // take longest here, so the wait has to outlast the old 15 s ceiling —
  // otherwise the very files this fix enables land without a duration.
  it('still resolves the duration when metadata arrives after 30 s (long video)', async () => {
    jest.useFakeTimers()
    const promise = readMediaDuration(file)
    jest.advanceTimersByTime(30000)
    mockElement.duration = 125.7
    mockElement.onloadedmetadata?.()
    const result = await promise
    jest.useRealTimers()
    expect(result).toBe(126)
  })
})
