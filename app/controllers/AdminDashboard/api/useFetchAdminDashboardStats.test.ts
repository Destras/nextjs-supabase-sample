import { renderHook, waitFor } from '@testing-library/react'
import type { AdminDashboardStats } from '../AdminDashboardTypes'
import { fetchAdminDashboardStats } from './fetchAdminDashboardStats'
import { useFetchAdminDashboardStats } from './useFetchAdminDashboardStats'

jest.mock('./fetchAdminDashboardStats')

describe('useFetchAdminDashboardStats', () => {
  let fixture: AdminDashboardStats

  beforeEach(() => {
    fixture = {
      pacientesActivos: 12,
      nuevosEsteMes: 0,
      alertasTotales: 3,
      scorePromedio: 3.6,
      distribucionEtapa: [{ label: '1', cantidad: 12, pct: 100 }],
      distribucionMes: [{ label: 'Mes 1', cantidad: 12, pct: 100 }],
    }
  })

  it('transitions from loading to ready with stats on success', async () => {
    ;(fetchAdminDashboardStats as jest.Mock).mockResolvedValue(fixture)
    const { result } = renderHook(() => useFetchAdminDashboardStats())
    await waitFor(() => {
      expect(result.current).toEqual({
        stats: fixture,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('transitions from loading to error when the fetch rejects with an Error', async () => {
    ;(fetchAdminDashboardStats as jest.Mock).mockRejectedValue(
      new Error('boom'),
    )
    const { result } = renderHook(() => useFetchAdminDashboardStats())
    await waitFor(() => {
      expect(result.current).toEqual({
        stats: null,
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('surfaces the error code when the fetch rejects with a PostgrestError object', async () => {
    ;(fetchAdminDashboardStats as jest.Mock).mockRejectedValue({
      message: 'no_autorizado',
      code: '42501',
    })
    const { result } = renderHook(() => useFetchAdminDashboardStats())
    await waitFor(() => {
      expect(result.current.error).toBe('no_autorizado')
    })
  })
})
