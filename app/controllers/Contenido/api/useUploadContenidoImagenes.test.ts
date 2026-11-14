import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useUploadContenidoImagenes } from './useUploadContenidoImagenes'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

const makeFile = (name: string, type = 'image/jpeg'): File =>
  new File(['x'], name, { type })

describe('useUploadContenidoImagenes', () => {
  let mockUpload: jest.Mock
  let mockRemove: jest.Mock
  let mockFrom: jest.Mock

  beforeEach(() => {
    mockUpload = jest.fn().mockResolvedValue({ error: null })
    mockRemove = jest.fn()
    mockFrom = jest.fn().mockReturnValue({
      upload: mockUpload,
      remove: mockRemove,
    })
    ;(createClient as jest.Mock).mockReturnValue({
      storage: { from: mockFrom },
    })
  })

  it('adds a valid file as a pending item preserving selection order', async () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    await act(async () => {
      result.current.addFiles([makeFile('a.jpg'), makeFile('b.jpg')])
    })
    expect(result.current.items.map((i) => i.file.name)).toEqual([
      'a.jpg',
      'b.jpg',
    ])
  })

  it('builds a flat objectName cma/<uuid>.<ext> with no leading slash', async () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    await act(async () => {
      result.current.addFiles([makeFile('photo.jpg')])
    })
    expect(result.current.items[0]?.objectName).toMatch(
      /^cma\/[0-9a-f-]+\.jpg$/,
    )
  })

  it('builds an ic/<uuid>.<ext> objectName for tipo=ic', async () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('ic'))
    await act(async () => {
      result.current.addFiles([makeFile('photo.png', 'image/png')])
    })
    expect(result.current.items[0]?.objectName).toMatch(/^ic\/[0-9a-f-]+\.png$/)
  })

  it('rejects an invalid file straight into error status without uploading', () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('doc.pdf', 'application/pdf')])
    })
    expect(result.current.items[0]).toMatchObject({
      status: 'error',
      error: 'formato_invalido',
    })
  })

  it('does not call storage.upload for a file rejected by validateImageFile', () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('doc.pdf', 'application/pdf')])
    })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('calls storage.upload with upsert:false and the file contentType', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    const file = makeFile('a.jpg')
    act(() => {
      result.current.addFiles([file])
    })
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1)
    })
    expect(mockUpload.mock.calls[0]).toEqual([
      result.current.items[0]?.objectName,
      file,
      { contentType: 'image/jpeg', upsert: false },
    ])
  })

  it('uses the contenidos-imagenes bucket', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contenidos-imagenes')
    })
  })

  it('caps concurrent uploads at 3 when more than 3 files are added', () => {
    const released: Array<() => void> = []
    mockUpload.mockImplementation(
      () =>
        new Promise((resolve) => {
          released.push(() => resolve({ error: null }))
        }),
    )
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([
        makeFile('1.jpg'),
        makeFile('2.jpg'),
        makeFile('3.jpg'),
        makeFile('4.jpg'),
        makeFile('5.jpg'),
      ])
    })
    expect(mockUpload).toHaveBeenCalledTimes(3)
  })

  it('starts the 4th upload once one of the first 3 settles', async () => {
    const released: Array<() => void> = []
    mockUpload.mockImplementation(
      () =>
        new Promise((resolve) => {
          released.push(() => resolve({ error: null }))
        }),
    )
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([
        makeFile('1.jpg'),
        makeFile('2.jpg'),
        makeFile('3.jpg'),
        makeFile('4.jpg'),
      ])
    })
    await act(async () => {
      released[0]?.()
    })
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(4)
    })
  })

  it('transitions an item to done when upload succeeds', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('done')
    })
  })

  it('transitions an item to error with upload_failed when upload fails, without aborting others', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: new Error('boom') })
      .mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('bad.jpg'), makeFile('good.jpg')])
    })
    await waitFor(() => {
      expect(result.current.items.map((i) => i.status)).toEqual([
        'error',
        'done',
      ])
    })
  })

  it('retry() re-attempts the upload for an errored item', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: new Error('boom') })
      .mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('error')
    })
    act(() => {
      result.current.retry(result.current.items[0]!.objectName)
    })
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('done')
    })
  })

  it('retry() does not upload a file that was rejected before uploading', () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('doc.pdf', 'application/pdf')])
    })
    act(() => {
      result.current.retry(result.current.items[0]!.objectName)
    })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('retry() keeps the rejection reason of a file rejected before uploading', () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('doc.pdf', 'application/pdf')])
    })
    act(() => {
      result.current.retry(result.current.items[0]!.objectName)
    })
    expect(result.current.items[0]).toMatchObject({
      status: 'error',
      error: 'formato_invalido',
    })
  })

  it('remove() drops a not-yet-done item from items without purging storage', () => {
    mockUpload.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    const objectName = result.current.items[0]!.objectName
    act(() => {
      result.current.remove(objectName)
    })
    expect(result.current.items).toEqual([])
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('remove() best-effort purges storage for an already-done item', async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockRemove.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('done')
    })
    const objectName = result.current.items[0]!.objectName
    act(() => {
      result.current.remove(objectName)
    })
    expect(mockRemove).toHaveBeenCalledWith([objectName])
  })

  it('successfulPaths reflects only done items, in original selection order', async () => {
    mockUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('boom') })
      .mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([
        makeFile('1.jpg'),
        makeFile('2.jpg'),
        makeFile('3.jpg'),
      ])
    })
    await waitFor(() => {
      expect(
        result.current.items.every(
          (i) => i.status === 'done' || i.status === 'error',
        ),
      ).toBe(true)
    })
    expect(result.current.successfulPaths).toEqual([
      result.current.items[0]?.objectName,
      result.current.items[2]?.objectName,
    ])
  })

  it('canSubmit is false when items is empty', () => {
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is false while any item is not done', () => {
    mockUpload.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    expect(result.current.canSubmit).toBe(false)
  })

  it('canSubmit is true when every item is done', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(result.current.canSubmit).toBe(true)
    })
  })

  it('reset() clears every item', async () => {
    mockUpload.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUploadContenidoImagenes('cma'))
    act(() => {
      result.current.addFiles([makeFile('a.jpg')])
    })
    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('done')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.items).toEqual([])
  })
})
