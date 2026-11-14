'use client'

import { act, renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useFetchContenidoMediaUrl } from './useFetchContenidoMediaUrl'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useFetchContenidoMediaUrl', () => {
  let mockCreateSignedUrl: jest.Mock

  beforeEach(() => {
    mockCreateSignedUrl = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: mockCreateSignedUrl,
        }),
      },
    })
  })

  it('returns idle state when recursoRef is null', async () => {
    const { result } = renderHook(() => useFetchContenidoMediaUrl(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        src: null,
        isLoading: false,
        error: null,
        retry: expect.any(Function),
      })
    })
  })

  it('does not call createSignedUrl when recursoRef is null', async () => {
    renderHook(() => useFetchContenidoMediaUrl(null))
    await waitFor(() => {
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })
  })

  it('returns the signed URL when createSignedUrl succeeds', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.url/video.mp4' },
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchContenidoMediaUrl('videos/uuid-clip.mp4'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        src: 'https://signed.url/video.mp4',
        isLoading: false,
        error: null,
        retry: expect.any(Function),
      })
    })
  })

  it('returns error state when createSignedUrl returns an error', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('Object not found'),
    })
    const { result } = renderHook(() =>
      useFetchContenidoMediaUrl('videos/missing.mp4'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        src: null,
        isLoading: false,
        error: 'signed_url_failed',
        retry: expect.any(Function),
      })
    })
  })

  it('re-calls createSignedUrl when retry() is invoked', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.url/video.mp4' },
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchContenidoMediaUrl('videos/uuid-clip.mp4'),
    )
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    await act(async () => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2)
    })
  })
})
