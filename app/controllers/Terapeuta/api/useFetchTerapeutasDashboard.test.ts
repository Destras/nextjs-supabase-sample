import { renderHook, waitFor } from '@testing-library/react'
import type { TerapeutaRollup } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'
import { fetchTerapeutasDashboard } from './fetchTerapeutasDashboard'
import { useFetchTerapeutasDashboard } from './useFetchTerapeutasDashboard'

jest.mock('./fetchTerapeutasDashboard')

describe('useFetchTerapeutasDashboard', () => {
  let fixture: TerapeutaRollup

  beforeEach(() => {
    fixture = {
      id: 't-1',
      nombre: 'Laura Martínez',
      estado: TERAPEUTA_STATE.ACTIVO,
      pacientesActivos: 6,
      scorePromedio: 3.8,
      alertasActivas: 1,
    }
  })

  it('transitions from loading to ready with the rollup on success', async () => {
    ;(fetchTerapeutasDashboard as jest.Mock).mockResolvedValue([fixture])
    const { result } = renderHook(() => useFetchTerapeutasDashboard())
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeutas: [fixture],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('transitions from loading to error when the fetch rejects with an Error', async () => {
    ;(fetchTerapeutasDashboard as jest.Mock).mockRejectedValue(
      new Error('boom'),
    )
    const { result } = renderHook(() => useFetchTerapeutasDashboard())
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeutas: [],
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('surfaces the error code when the fetch rejects with a PostgrestError object', async () => {
    ;(fetchTerapeutasDashboard as jest.Mock).mockRejectedValue({
      message: 'no_autorizado',
      code: '42501',
    })
    const { result } = renderHook(() => useFetchTerapeutasDashboard())
    await waitFor(() => {
      expect(result.current.error).toBe('no_autorizado')
    })
  })
})
