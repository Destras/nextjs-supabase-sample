'use client'

import { renderHook, act } from '@testing-library/react'
import Uppy from '@uppy/core'
import { createClient } from '@/lib/supabase/client'
import { validateMediaFile } from '../utils/validateMediaFile'
import { readMediaDuration } from '../utils/readMediaDuration'
import { uppyLocaleEs } from '../utils/uppyLocaleEs'
import { useUploadContenidoMedia } from './useUploadContenidoMedia'

// JSDOM does not implement URL.createObjectURL / revokeObjectURL
global.URL.createObjectURL = jest.fn()
global.URL.revokeObjectURL = jest.fn()

// Stub crypto.randomUUID for deterministic objectName assertions
const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: jest.fn(() => FIXED_UUID) },
  configurable: true,
})

// ──────────────────────────────────────────────────────────────
// Uppy mock
// We capture the event handlers and the onBeforeFileAdded option
// so tests can trigger them directly.
// ──────────────────────────────────────────────────────────────
type EventHandler = (...args: unknown[]) => void

let mockUppyInstance: {
  on: jest.Mock
  use: jest.Mock
  setOptions: jest.Mock
  cancelAll: jest.Mock
  destroy: jest.Mock
  _handlers: Record<string, EventHandler>
  _onBeforeFileAdded: ((file: unknown) => boolean) | undefined
}

jest.mock('@uppy/core', () => {
  const MockUppy = jest
    .fn()
    .mockImplementation(
      (opts: { onBeforeFileAdded?: (file: unknown) => boolean }) => {
        mockUppyInstance = {
          on: jest.fn((event: string, handler: EventHandler) => {
            mockUppyInstance._handlers[event] = handler
            return mockUppyInstance
          }),
          use: jest.fn(() => mockUppyInstance),
          setOptions: jest.fn(() => mockUppyInstance),
          cancelAll: jest.fn(),
          destroy: jest.fn(),
          _handlers: {},
          _onBeforeFileAdded: opts?.onBeforeFileAdded,
        }
        return mockUppyInstance
      },
    )
  return { __esModule: true, default: MockUppy, Uppy: MockUppy }
})

jest.mock('@uppy/tus', () => ({ default: jest.fn() }))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

jest.mock('../utils/validateMediaFile', () => ({
  validateMediaFile: jest.fn(),
}))

jest.mock('../utils/readMediaDuration', () => ({
  readMediaDuration: jest.fn(),
}))

describe('useUploadContenidoMedia', () => {
  // Storage reconciliation mock (CON-002). Default behaviour: the object the
  // hook asks for is "found" with whatever size the search term implies a
  // match for — the default echoes the searched filename back so existence
  // checks succeed; size-sensitive tests override `listMock` explicitly.
  let listMock: jest.Mock

  beforeEach(() => {
    listMock = jest.fn(
      (_folder: string, opts: { search?: string } | undefined) =>
        Promise.resolve({
          data: [{ name: opts?.search, metadata: { size: 0 } }],
          error: null,
        }),
    )
    ;(createClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'tok-123' } },
        }),
      },
      storage: {
        from: jest.fn(() => ({ list: listMock })),
      },
    })
    ;(validateMediaFile as jest.Mock).mockReturnValue({ ok: true })
    ;(readMediaDuration as jest.Mock).mockResolvedValue(null)
  })

  it('starts in idle state with all fields null', () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    expect(result.current).toEqual({
      uppy: expect.any(Object),
      state: 'idle',
      recursoRef: null,
      duracionSeg: null,
      fileName: null,
      error: null,
      reset: expect.any(Function),
    })
  })

  it('builds Uppy with the Spanish locale so the status bar is not in English', () => {
    renderHook(() => useUploadContenidoMedia('videos'))
    expect(Uppy).toHaveBeenCalledWith(
      expect.objectContaining({ locale: uppyLocaleEs }),
    )
  })

  it('sets state to uploading and fileName when file-added fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const fakeFile = {
      name: 'my video.mp4',
      data: new File([], 'my video.mp4', { type: 'video/mp4' }),
      meta: { objectName: `videos/${FIXED_UUID}-my-video.mp4` },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](fakeFile)
    })
    expect(result.current.state).toBe('uploading')
  })

  it('sets fileName from the file name when file-added fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const fakeFile = {
      name: 'my video.mp4',
      data: new File([], 'my video.mp4', { type: 'video/mp4' }),
      meta: { objectName: `videos/${FIXED_UUID}-my-video.mp4` },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](fakeFile)
    })
    expect(result.current.fileName).toBe('my video.mp4')
  })

  it('sets state to uploaded when complete fires with a successful file', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const successfulFile = {
      name: 'clip.mp4',
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [successfulFile],
        failed: [],
      })
    })
    expect(result.current.state).toBe('uploaded')
  })

  it('sets recursoRef to the objectName from the first successful file on complete', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const successfulFile = {
      name: 'clip.mp4',
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [successfulFile],
        failed: [],
      })
    })
    expect(result.current.recursoRef).toBe(objectName)
  })

  it('sets state to error (not uploaded) when complete fires with no successful files', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const failedFile = {
      name: 'clip.mp4',
      meta: { objectName: `videos/${FIXED_UUID}-clip.mp4` },
    }
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [],
        failed: [failedFile],
      })
    })
    expect(result.current.state).toBe('error')
  })

  it('sets error to upload_failed when complete fires with no successful files', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const failedFile = {
      name: 'clip.mp4',
      meta: { objectName: `videos/${FIXED_UUID}-clip.mp4` },
    }
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [],
        failed: [failedFile],
      })
    })
    expect(result.current.error).toBe('upload_failed')
  })

  it('leaves recursoRef null when complete fires with no successful files', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const failedFile = {
      name: 'clip.mp4',
      meta: { objectName: `videos/${FIXED_UUID}-clip.mp4` },
    }
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [],
        failed: [failedFile],
      })
    })
    expect(result.current.recursoRef).toBeNull()
  })

  // ── CON-002: reconcile against Storage ─────────────────────
  it('marks uploaded when complete reports no successful files but the object finalized in Storage', async () => {
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const file = {
      name: 'clip.mp4',
      size: 0,
      data: new File([], 'clip.mp4', { type: 'video/mp4' }),
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](file)
    })
    await act(async () => {
      await mockUppyInstance._handlers['complete']({
        successful: [],
        failed: [file],
      })
    })
    expect(result.current.state).toBe('uploaded')
  })

  it('sets state to error when complete reports a successful file but the object is absent from Storage', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      await mockUppyInstance._handlers['complete']({
        successful: [{ name: 'clip.mp4', meta: { objectName } }],
        failed: [],
      })
    })
    expect(result.current.state).toBe('error')
  })

  it('sets state to error when the finalized object size does not match the uploaded file', async () => {
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    listMock.mockResolvedValue({
      data: [{ name: `${FIXED_UUID}-clip.mp4`, metadata: { size: 999 } }],
      error: null,
    })
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const file = {
      name: 'clip.mp4',
      size: 16,
      data: new File([], 'clip.mp4', { type: 'video/mp4' }),
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](file)
    })
    await act(async () => {
      await mockUppyInstance._handlers['complete']({
        successful: [{ name: 'clip.mp4', meta: { objectName } }],
        failed: [],
      })
    })
    expect(result.current.state).toBe('error')
  })

  // ── CON-020: reset during an in-flight reconcile must not write stale state ──
  it('does not set uploaded/recursoRef when reset() runs during an in-flight reconcile (CON-020)', async () => {
    // A deferred list() promise lets us park finalize() on its await and
    // interleave a reset() (tab switch / cancel) before the reconcile resolves.
    let resolveList!: (value: {
      data: { name: string; metadata: { size: number } }[]
      error: null
    }) => void
    const listPromise = new Promise<{
      data: { name: string; metadata: { size: number } }[]
      error: null
    }>((resolve) => {
      resolveList = resolve
    })
    listMock.mockReturnValue(listPromise)

    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const file = {
      name: 'clip.mp4',
      size: 0,
      data: new File([], 'clip.mp4', { type: 'video/mp4' }),
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](file)
    })

    // Fire complete but leave the reconcile pending: finalize() is parked on
    // the list() await.
    let completePromise: Promise<void>
    await act(async () => {
      completePromise = mockUppyInstance._handlers['complete']({
        successful: [{ name: 'clip.mp4', meta: { objectName } }],
        failed: [],
      }) as unknown as Promise<void>
      // Let microtasks run so finalize() reaches the await.
      await Promise.resolve()
    })

    // Tab switch / cancel during the in-flight reconcile recreates the instance.
    await act(async () => {
      result.current.reset()
    })

    // Now the reconcile resolves: the old object exists in Storage.
    await act(async () => {
      resolveList({
        data: [{ name: `${FIXED_UUID}-clip.mp4`, metadata: { size: 0 } }],
        error: null,
      })
      await completePromise
    })

    expect(result.current.state).toBe('idle')
    expect(result.current.recursoRef).toBeNull()
  })

  it('marks uploaded when upload-error fires but the object finalized in Storage', async () => {
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const file = {
      name: 'clip.mp4',
      size: 0,
      data: new File([], 'clip.mp4', { type: 'video/mp4' }),
      meta: { objectName },
    }
    await act(async () => {
      mockUppyInstance._handlers['file-added'](file)
    })
    await act(async () => {
      await mockUppyInstance._handlers['upload-error'](
        undefined,
        new Error('net'),
      )
    })
    expect(result.current.state).toBe('uploaded')
  })

  it('returns a stable objectName when onBeforeFileAdded runs twice for the same file', () => {
    // Uppy may call onBeforeFileAdded more than once per file, so the handler
    // must be pure — generating a fresh UUID on each call would make the
    // reconciliation search an object that was never uploaded (CON-003).
    let counter = 0
    ;(crypto.randomUUID as jest.Mock).mockImplementation(
      () => `uuid-${counter++}`,
    )
    renderHook(() => useUploadContenidoMedia('videos'))
    const file = {
      name: 'clip.mp4',
      data: new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' }),
      meta: {},
    }
    const firstAdd = mockUppyInstance._onBeforeFileAdded?.(file) as unknown as {
      meta: { objectName: string }
    }
    const secondAdd = mockUppyInstance._onBeforeFileAdded?.(
      file,
    ) as unknown as {
      meta: { objectName: string }
    }
    expect(secondAdd.meta.objectName).toBe(firstAdd.meta.objectName)
  })

  it('configures the Tus plugin with retryDelays for the lost final-chunk race', () => {
    renderHook(() => useUploadContenidoMedia('videos'))
    const tusOptions = mockUppyInstance.use.mock.calls[0][1] as {
      retryDelays: number[]
    }
    expect(tusOptions.retryDelays).toEqual([0, 1000, 3000, 5000])
  })

  it('uses a no-op urlStorage so tus never resumes a stale upload pointing at an old objectName', async () => {
    renderHook(() => useUploadContenidoMedia('videos'))
    const tusOptions = mockUppyInstance.use.mock.calls[0][1] as {
      urlStorage: {
        findUploadsByFingerprint: (fp: string) => Promise<unknown[]>
      }
    }
    expect(
      await tusOptions.urlStorage.findUploadsByFingerprint('any-fingerprint'),
    ).toEqual([])
  })

  it('sets state to error when upload-error fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._handlers['upload-error'](undefined, new Error('net'))
    })
    expect(result.current.state).toBe('error')
  })

  it('sets error to upload_failed when upload-error fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._handlers['upload-error'](undefined, new Error('net'))
    })
    expect(result.current.error).toBe('upload_failed')
  })

  it('sets state to error when restriction-failed fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error('too many'),
      )
    })
    expect(result.current.state).toBe('error')
  })

  it('sets error to upload_failed when restriction-failed fires', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error('too many'),
      )
    })
    expect(result.current.error).toBe('upload_failed')
  })

  it('returns false from onBeforeFileAdded when validateMediaFile returns ok:false', () => {
    ;(validateMediaFile as jest.Mock).mockReturnValue({
      ok: false,
      error: 'formato_invalido',
    })
    renderHook(() => useUploadContenidoMedia('videos'))
    const fakeFile = { data: new File([], 'bad.avi', { type: 'video/avi' }) }
    let returnValue: boolean | undefined
    act(() => {
      returnValue = mockUppyInstance._onBeforeFileAdded?.(fakeFile) as boolean
    })
    expect(returnValue).toBe(false)
  })

  it('sets the validation error on state when validateMediaFile returns ok:false in onBeforeFileAdded', async () => {
    ;(validateMediaFile as jest.Mock).mockReturnValue({
      ok: false,
      error: 'formato_invalido',
    })
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._onBeforeFileAdded?.({
        data: new File([], 'bad.avi', { type: 'video/avi' }),
      })
    })
    expect(result.current.error).toBe('formato_invalido')
  })

  // Uppy's addFile() turns an onBeforeFileAdded rejection into a
  // RestrictionError and routes it through #informAndEmit, which emits
  // 'restriction-failed' for anything flagged isRestriction. That fires in the
  // same tick as our validator's setError, so a naive handler overwrites the
  // specific reason with the generic one and the user is told to "retry" an
  // upload that can never succeed. The specific reason has to win.
  it('keeps the validation error when restriction-failed fires right after onBeforeFileAdded rejected the file', async () => {
    ;(validateMediaFile as jest.Mock).mockReturnValue({
      ok: false,
      error: 'formato_invalido',
    })
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._onBeforeFileAdded?.({
        data: new File([], 'bad.mkv', { type: 'video/x-matroska' }),
      })
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error(
          'Cannot add the file because onBeforeFileAdded returned false.',
        ),
      )
    })
    expect(result.current.error).toBe('formato_invalido')
  })

  // The flag must be CONSUMED, not just read. Uppy can emit 'restriction-failed'
  // *before* onBeforeFileAdded runs — #assertNewUploadAllowed does exactly that
  // — so a flag left true by a previous rejection would swallow the next
  // genuine Uppy restriction and keep showing the stale reason. That path is
  // unreachable today only because allowMultipleUploadBatches keeps
  // allowNewUpload true; this test makes the guarantee structural instead of
  // incidental.
  it('does not let a consumed validator rejection suppress a later Uppy-raised restriction', async () => {
    ;(validateMediaFile as jest.Mock).mockReturnValue({
      ok: false,
      error: 'formato_invalido',
    })
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._onBeforeFileAdded?.({
        data: new File([], 'bad.mkv', { type: 'video/x-matroska' }),
      })
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error(
          'Cannot add the file because onBeforeFileAdded returned false.',
        ),
      )
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error('Cannot add new upload'),
      )
    })
    expect(result.current.error).toBe('upload_failed')
  })

  it('still reports upload_failed when restriction-failed fires for a file our validator accepted', async () => {
    ;(validateMediaFile as jest.Mock).mockReturnValue({ ok: true })
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._onBeforeFileAdded?.({
        name: 'ok.mp4',
        meta: {},
        data: new File([], 'ok.mp4', { type: 'video/mp4' }),
      })
      mockUppyInstance._handlers['restriction-failed'](
        undefined,
        new Error('You can only upload 1 file'),
      )
    })
    expect(result.current.error).toBe('upload_failed')
  })

  it('returns to idle state after reset() is called', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [{ name: 'clip.mp4', meta: { objectName } }],
        failed: [],
      })
    })
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.state).toBe('idle')
  })

  it('clears recursoRef after reset()', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const objectName = `videos/${FIXED_UUID}-clip.mp4`
    await act(async () => {
      mockUppyInstance._handlers['complete']({
        successful: [{ name: 'clip.mp4', meta: { objectName } }],
        failed: [],
      })
    })
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.recursoRef).toBeNull()
  })

  it('clears error after reset()', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      mockUppyInstance._handlers['upload-error'](undefined, new Error('net'))
    })
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.error).toBeNull()
  })

  it('destroys the previous Uppy instance when reset() is invoked (CON-019)', async () => {
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    const firstInstance = mockUppyInstance
    await act(async () => {
      result.current.reset()
    })
    expect(firstInstance.destroy).toHaveBeenCalled()
  })

  it('builds a fresh Uppy instance when reset() is invoked so a new file can be added (CON-019)', async () => {
    const ctorCallsBefore = (Uppy as unknown as jest.Mock).mock.calls.length
    const { result } = renderHook(() => useUploadContenidoMedia('videos'))
    await act(async () => {
      result.current.reset()
    })
    // one construction on mount + one on reset
    expect((Uppy as unknown as jest.Mock).mock.calls.length).toBe(
      ctorCallsBefore + 2,
    )
  })

  it('configures Uppy with allowMultipleUploadBatches so a completed batch does not block the next file (CON-019)', () => {
    renderHook(() => useUploadContenidoMedia('videos'))
    const opts = (Uppy as unknown as jest.Mock).mock.calls.at(-1)?.[0] as {
      allowMultipleUploadBatches?: boolean
    }
    expect(opts.allowMultipleUploadBatches).toBe(true)
  })

  it('calls uppy.destroy() on unmount', () => {
    const { unmount } = renderHook(() => useUploadContenidoMedia('videos'))
    unmount()
    expect(mockUppyInstance.destroy).toHaveBeenCalledTimes(1)
  })

  // ── CON-005: reconfigure on tab (tipo) change ──────────────────
  it('reconfigures Uppy allowedFileTypes to audio/* when the tab changes to mantras (CON-005)', () => {
    const { rerender } = renderHook(
      ({ tipo }: { tipo: 'videos' | 'mantras' }) =>
        useUploadContenidoMedia(tipo),
      { initialProps: { tipo: 'videos' as 'videos' | 'mantras' } },
    )
    act(() => rerender({ tipo: 'mantras' }))
    expect(mockUppyInstance.setOptions).toHaveBeenCalledWith({
      restrictions: { maxNumberOfFiles: 1, allowedFileTypes: ['audio/*'] },
    })
  })

  // BETA-044: el `accept` del input sale de `uppy.opts.restrictions` EN EL
  // RENDER (useDropzone().getInputProps()). Si la restricción se actualiza
  // recién en un efecto, ese render ya pintó el `accept` del tipo anterior.
  it('has already reconfigured allowedFileTypes during the render of the new tab (BETA-044)', () => {
    const { result, rerender } = renderHook(
      ({ tipo }: { tipo: 'videos' | 'mantras' }) => {
        useUploadContenidoMedia(tipo)
        return mockUppyInstance.setOptions.mock.lastCall
      },
      { initialProps: { tipo: 'videos' as 'videos' | 'mantras' } },
    )
    act(() => rerender({ tipo: 'mantras' }))
    expect(result.current).toEqual([
      { restrictions: { maxNumberOfFiles: 1, allowedFileTypes: ['audio/*'] } },
    ])
  })

  it('validates a newly added file against the current tab after a tipo change (CON-005)', () => {
    const { rerender } = renderHook(
      ({ tipo }: { tipo: 'videos' | 'mantras' }) =>
        useUploadContenidoMedia(tipo),
      { initialProps: { tipo: 'videos' as 'videos' | 'mantras' } },
    )
    act(() => rerender({ tipo: 'mantras' }))
    const file = {
      name: 'song.mp3',
      data: new File([], 'song.mp3', { type: 'audio/mpeg' }),
      meta: {},
    }
    act(() => {
      mockUppyInstance._onBeforeFileAdded?.(file)
    })
    expect(validateMediaFile).toHaveBeenCalledWith(file.data, 'mantras')
  })

  it('builds an audios/ objectName after switching to the mantras tab (CON-005)', () => {
    const { rerender } = renderHook(
      ({ tipo }: { tipo: 'videos' | 'mantras' }) =>
        useUploadContenidoMedia(tipo),
      { initialProps: { tipo: 'videos' as 'videos' | 'mantras' } },
    )
    act(() => rerender({ tipo: 'mantras' }))
    const file = {
      name: 'song.mp3',
      data: new File([new Uint8Array(5)], 'song.mp3', { type: 'audio/mpeg' }),
      meta: {},
    }
    const added = mockUppyInstance._onBeforeFileAdded?.(file) as unknown as {
      meta: { objectName: string }
    }
    expect(added.meta.objectName.startsWith('audios/')).toBe(true)
  })

  // ── Egregores reuse the video pipeline verbatim (design §8.2) ─────────────

  it('builds an egregores/ objectName for the egregores tab', () => {
    renderHook(() => useUploadContenidoMedia('egregores'))
    const file = {
      name: 'clip.mp4',
      data: new File([new Uint8Array(5)], 'clip.mp4', { type: 'video/mp4' }),
      meta: {},
    }
    const added = mockUppyInstance._onBeforeFileAdded?.(file) as unknown as {
      meta: { objectName: string }
    }
    expect(added.meta.objectName.startsWith('egregores/')).toBe(true)
  })

  it('restricts allowedFileTypes to video/* for the egregores tab', () => {
    renderHook(() => useUploadContenidoMedia('egregores'))
    expect((Uppy as unknown as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        restrictions: expect.objectContaining({
          allowedFileTypes: ['video/*'],
        }),
      }),
    )
  })

  it('validates a newly added file against egregores via validateMediaFile', () => {
    renderHook(() => useUploadContenidoMedia('egregores'))
    const file = {
      name: 'clip.mp4',
      data: new File([new Uint8Array(5)], 'clip.mp4', { type: 'video/mp4' }),
      meta: {},
    }
    act(() => {
      mockUppyInstance._onBeforeFileAdded?.(file)
    })
    expect(validateMediaFile).toHaveBeenCalledWith(file.data, 'egregores')
  })
})
