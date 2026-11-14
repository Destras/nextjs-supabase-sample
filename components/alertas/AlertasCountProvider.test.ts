import { act, renderHook } from '@testing-library/react'
import { useAlertasCount } from '@/app/controllers/Alerta'
import {
  AlertasCountProvider,
  useAlertasCountValue,
} from './AlertasCountProvider'

jest.mock('@/app/controllers/Alerta', () => ({
  useAlertasCount: jest.fn(),
}))

describe('AlertasCountProvider / useAlertasCountValue', () => {
  beforeEach(() => {
    ;(useAlertasCount as jest.Mock).mockReturnValue({
      count: 3,
      isLoading: false,
      error: null,
    })
  })

  it('initializes count from the fetched value returned by useAlertasCount', () => {
    const { result } = renderHook(() => useAlertasCountValue(), {
      wrapper: AlertasCountProvider,
    })
    expect(result.current.count).toBe(3)
  })

  it('adjust(-1) decrements the count', () => {
    const { result } = renderHook(() => useAlertasCountValue(), {
      wrapper: AlertasCountProvider,
    })
    act(() => {
      result.current.adjust(-1)
    })
    expect(result.current.count).toBe(2)
  })

  it('adjust never lets the count go below 0', () => {
    ;(useAlertasCount as jest.Mock).mockReturnValue({
      count: 0,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useAlertasCountValue(), {
      wrapper: AlertasCountProvider,
    })
    act(() => {
      result.current.adjust(-1)
    })
    expect(result.current.count).toBe(0)
  })

  it('re-syncs count when the fetched value from useAlertasCount changes', () => {
    const { result, rerender } = renderHook(() => useAlertasCountValue(), {
      wrapper: AlertasCountProvider,
    })
    ;(useAlertasCount as jest.Mock).mockReturnValue({
      count: 7,
      isLoading: false,
      error: null,
    })
    rerender()
    expect(result.current.count).toBe(7)
  })
})
