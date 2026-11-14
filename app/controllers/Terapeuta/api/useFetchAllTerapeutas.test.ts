import { act, renderHook, waitFor } from '@testing-library/react'
import type { Terapeuta } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'
import { ROLE } from '@/app/controllers/Auth'
import { fetchAllTerapeutas } from './fetchAllTerapeutas'
import { useFetchAllTerapeutas } from './useFetchAllTerapeutas'

jest.mock('./fetchAllTerapeutas')

describe('useFetchAllTerapeutas', () => {
  let fixture: Terapeuta

  beforeEach(() => {
    fixture = {
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: null,
      pacientesActivos: 2,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: '',
        email: 'ana@clinic.com',
      },
    }
  })

  it('transitions from loading to ready with terapeutas on success', async () => {
    ;(fetchAllTerapeutas as jest.Mock).mockResolvedValue([fixture])
    const { result } = renderHook(() => useFetchAllTerapeutas())
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
    ;(fetchAllTerapeutas as jest.Mock).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useFetchAllTerapeutas())
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeutas: [],
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('transitions from loading to error when the fetch rejects with a PostgrestError object', async () => {
    ;(fetchAllTerapeutas as jest.Mock).mockRejectedValue({
      message: 'no_autorizado',
      code: '42501',
    })
    const { result } = renderHook(() => useFetchAllTerapeutas())
    await waitFor(() => {
      expect(result.current).toEqual({
        terapeutas: [],
        isLoading: false,
        error: 'no_autorizado',
        refresh: expect.any(Function),
      })
    })
  })

  it('re-invokes fetchAllTerapeutas when refresh() is called', async () => {
    ;(fetchAllTerapeutas as jest.Mock).mockResolvedValue([fixture])
    const { result } = renderHook(() => useFetchAllTerapeutas())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const callsBefore = (fetchAllTerapeutas as jest.Mock).mock.calls.length
    act(() => {
      result.current.refresh()
    })
    await waitFor(() => {
      expect(
        (fetchAllTerapeutas as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(callsBefore)
    })
  })
})
