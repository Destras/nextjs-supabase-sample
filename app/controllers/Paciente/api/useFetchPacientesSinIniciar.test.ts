import { renderHook, waitFor } from '@testing-library/react'
import { fetchPacientesSinIniciar } from './fetchPacientesSinIniciar'
import { useFetchPacientesSinIniciar } from './useFetchPacientesSinIniciar'

jest.mock('./fetchPacientesSinIniciar')

describe('useFetchPacientesSinIniciar', () => {
  it('does not fetch and is not loading when terapeutaId is null', () => {
    const { result } = renderHook(() => useFetchPacientesSinIniciar(null))
    expect(result.current).toEqual({
      pacientes: [],
      isLoading: false,
      error: null,
    })
  })

  it('returns the pacientes sin iniciar on success', async () => {
    ;(fetchPacientesSinIniciar as jest.Mock).mockResolvedValue({
      data: [{ id: 'p-1', nombre: 'Juan' }],
      error: null,
    })
    const { result } = renderHook(() => useFetchPacientesSinIniciar('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        pacientes: [{ id: 'p-1', nombre: 'Juan' }],
        isLoading: false,
        error: null,
      })
    })
  })

  it('surfaces the error message when the fetch returns an error', async () => {
    ;(fetchPacientesSinIniciar as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchPacientesSinIniciar('t-1'))
    await waitFor(() => {
      expect(result.current.error).toBe('boom')
    })
  })
})
