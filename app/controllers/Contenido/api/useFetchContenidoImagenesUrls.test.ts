import { renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useFetchContenidoImagenesUrls } from './useFetchContenidoImagenesUrls'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useFetchContenidoImagenesUrls', () => {
  let mockCreateSignedUrls: jest.Mock

  beforeEach(() => {
    mockCreateSignedUrls = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrls: mockCreateSignedUrls,
        }),
      },
    })
  })

  it('returns idle state when paths is empty', async () => {
    const { result } = renderHook(() => useFetchContenidoImagenesUrls([]))
    await waitFor(() => {
      expect(result.current).toEqual({
        urls: [],
        isLoading: false,
        error: null,
      })
    })
  })

  it('does not call createSignedUrls when paths is empty', async () => {
    renderHook(() => useFetchContenidoImagenesUrls([]))
    await waitFor(() => {
      expect(mockCreateSignedUrls).not.toHaveBeenCalled()
    })
  })

  it('calls createSignedUrls with the given paths and a 3600s TTL', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [], error: null })
    renderHook(() => useFetchContenidoImagenesUrls(['cma/a.jpg', 'cma/b.jpg']))
    await waitFor(() => {
      expect(mockCreateSignedUrls).toHaveBeenCalledWith(
        ['cma/a.jpg', 'cma/b.jpg'],
        3600,
      )
    })
  })

  it('returns the signed urls when createSignedUrls succeeds', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        {
          error: null,
          path: 'cma/a.jpg',
          signedUrl: 'https://signed.url/a.jpg',
        },
        {
          error: null,
          path: 'cma/b.jpg',
          signedUrl: 'https://signed.url/b.jpg',
        },
      ],
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchContenidoImagenesUrls(['cma/a.jpg', 'cma/b.jpg']),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        urls: [
          { path: 'cma/a.jpg', signedUrl: 'https://signed.url/a.jpg' },
          { path: 'cma/b.jpg', signedUrl: 'https://signed.url/b.jpg' },
        ],
        isLoading: false,
        error: null,
      })
    })
  })

  it('drops entries Storage could not sign (per-item error)', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        {
          error: null,
          path: 'cma/a.jpg',
          signedUrl: 'https://signed.url/a.jpg',
        },
        { error: 'not_found', path: null, signedUrl: null },
      ],
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchContenidoImagenesUrls(['cma/a.jpg', 'cma/missing.jpg']),
    )
    await waitFor(() => {
      expect(result.current.urls).toEqual([
        { path: 'cma/a.jpg', signedUrl: 'https://signed.url/a.jpg' },
      ])
    })
  })

  it('returns error state when createSignedUrls returns an error', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() =>
      useFetchContenidoImagenesUrls(['cma/a.jpg']),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        urls: [],
        isLoading: false,
        error: 'signed_urls_failed',
      })
    })
  })

  it('re-fetches when the paths list changes', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [], error: null })
    const { rerender } = renderHook(
      ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
        useFetchContenidoImagenesUrls(paths),
      { initialProps: { paths: ['cma/a.jpg'] } },
    )
    await waitFor(() => {
      expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1)
    })
    rerender({ paths: ['cma/a.jpg', 'cma/b.jpg'] })
    await waitFor(() => {
      expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2)
    })
  })
})
