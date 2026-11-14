import { act, renderHook, waitFor } from '@testing-library/react'
import type { CerrarEtapaPayload } from '../PacienteTypes'
import { cerrarEtapa } from './cerrarEtapa'
import { useCerrarEtapa } from './useCerrarEtapa'

jest.mock('./cerrarEtapa')

describe('useCerrarEtapa', () => {
  let payload: CerrarEtapaPayload

  beforeEach(() => {
    payload = {
      pacienteId: 'paciente-uuid-1',
      estado: 'finalizada',
      motivo: null,
    }
  })

  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useCerrarEtapa())
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result from submit on success', async () => {
    ;(cerrarEtapa as jest.Mock).mockResolvedValue({ error: null })
    const { result } = renderHook(() => useCerrarEtapa())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: null })
  })

  it('returns the result from submit on error', async () => {
    ;(cerrarEtapa as jest.Mock).mockResolvedValue({
      error: 'etapa_no_encontrada',
    })
    const { result } = renderHook(() => useCerrarEtapa())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: 'etapa_no_encontrada' })
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(cerrarEtapa as jest.Mock).mockRejectedValue(
      new Error('network unreachable'),
    )
    const { result } = renderHook(() => useCerrarEtapa())

    await act(async () => {
      await expect(result.current.submit(payload)).rejects.toThrow(
        'network unreachable',
      )
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls without firing a second RPC', async () => {
    let resolveRpc!: (value: { error: string | null }) => void
    ;(cerrarEtapa as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useCerrarEtapa())

    act(() => {
      void result.current.submit(payload)
      void result.current.submit(payload)
    })

    expect((cerrarEtapa as jest.Mock).mock.calls).toHaveLength(1)

    resolveRpc({ error: null })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })
})
