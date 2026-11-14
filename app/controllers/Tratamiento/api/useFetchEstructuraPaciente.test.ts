import { renderHook, waitFor, act } from '@testing-library/react'
import type { EstructuraPaciente } from '../TratamientoTypes'
import { fetchEstructuraPaciente } from './fetchEstructuraPaciente'
import { useFetchEstructuraPaciente } from './useFetchEstructuraPaciente'

jest.mock('./fetchEstructuraPaciente')

describe('useFetchEstructuraPaciente', () => {
  let estructuraFixture: EstructuraPaciente

  beforeEach(() => {
    estructuraFixture = {
      pacienteId: 'p-1',
      puedeMedir: true,
      esAdmin: false,
      centrosActivos: [],
      etapas: [],
    }
  })

  it('noops when pacienteId is null returning idle state', async () => {
    const { result } = renderHook(() => useFetchEstructuraPaciente(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        data: null,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with data and isLoading false on success', async () => {
    ;(fetchEstructuraPaciente as jest.Mock).mockResolvedValue({
      data: estructuraFixture,
      error: null,
    })

    const { result } = renderHook(() => useFetchEstructuraPaciente('p-1'))

    await waitFor(() => {
      expect(result.current).toEqual({
        data: estructuraFixture,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with error and null data when fetch returns an error', async () => {
    ;(fetchEstructuraPaciente as jest.Mock).mockResolvedValue({
      data: null,
      error: 'boom',
    })

    const { result } = renderHook(() => useFetchEstructuraPaciente('p-1'))

    await waitFor(() => {
      expect(result.current).toEqual({
        data: null,
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('re-fetches when refresh is called', async () => {
    ;(fetchEstructuraPaciente as jest.Mock).mockResolvedValue({
      data: estructuraFixture,
      error: null,
    })

    const { result } = renderHook(() => useFetchEstructuraPaciente('p-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect((fetchEstructuraPaciente as jest.Mock).mock.calls.length).toBe(2)
    })
  })
})
