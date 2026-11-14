import { act, renderHook, waitFor } from '@testing-library/react'
import type { Terapeuta } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'
import { ROLE } from '@/app/controllers/Auth'
import { fetchTerapeutaById } from './fetchTerapeutaById'
import { useFetchTerapeutaById } from './useFetchTerapeutaById'

jest.mock('./fetchTerapeutaById')

describe('useFetchTerapeutaById', () => {
  let fixture: Terapeuta

  beforeEach(() => {
    fixture = {
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: '',
      },
    }
  })

  it('stays idle with null terapeuta when terapeutaId is null', async () => {
    const { result } = renderHook(() => useFetchTerapeutaById(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeuta: null,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchTerapeutaById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchTerapeutaById('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeuta: null,
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('returns the fetched terapeuta when the fetch succeeds', async () => {
    ;(fetchTerapeutaById as jest.Mock).mockResolvedValue({
      data: fixture,
      error: null,
    })
    const { result } = renderHook(() => useFetchTerapeutaById('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeuta: fixture,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('refresh() triggers a re-fetch of the terapeuta', async () => {
    ;(fetchTerapeutaById as jest.Mock).mockResolvedValue({
      data: fixture,
      error: null,
    })
    const { result } = renderHook(() => useFetchTerapeutaById('t-1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchTerapeutaById).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.refresh()
    })

    expect(fetchTerapeutaById).toHaveBeenCalledTimes(2)
  })
})
