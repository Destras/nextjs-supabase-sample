import { act, renderHook, waitFor } from '@testing-library/react'
import type { SetEtapaAlfabetosPayload } from '../PacienteTypes'
import { setEtapaAlfabetos } from './setEtapaAlfabetos'
import { useSetEtapaAlfabetos } from './useSetEtapaAlfabetos'

jest.mock('./setEtapaAlfabetos')

describe('useSetEtapaAlfabetos', () => {
  let payload: SetEtapaAlfabetosPayload

  beforeEach(() => {
    payload = {
      pacienteId: 'paciente-uuid-1',
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1] }],
    }
  })

  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useSetEtapaAlfabetos())
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result from submit on success', async () => {
    ;(setEtapaAlfabetos as jest.Mock).mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: null })
  })

  it('returns the error code from submit on error', async () => {
    ;(setEtapaAlfabetos as jest.Mock).mockResolvedValue({
      error: 'numeros_invalidos',
    })
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: 'numeros_invalidos' })
  })

  it('has isSubmitting true while the call is in flight', async () => {
    let resolveRpc!: (value: { error: string | null }) => void
    ;(setEtapaAlfabetos as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    act(() => {
      void result.current.submit(payload)
    })

    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      resolveRpc({ error: null })
    })
  })

  it('resets isSubmitting to false once the call resolves', async () => {
    let resolveRpc!: (value: { error: string | null }) => void
    ;(setEtapaAlfabetos as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    act(() => {
      void result.current.submit(payload)
    })
    resolveRpc({ error: null })

    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('propagates the error when the RPC throws', async () => {
    ;(setEtapaAlfabetos as jest.Mock).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    await expect(act(() => result.current.submit(payload))).rejects.toThrow(
      'boom',
    )
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(setEtapaAlfabetos as jest.Mock).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useSetEtapaAlfabetos())

    await act(async () => {
      await result.current.submit(payload).catch(() => undefined)
    })

    expect(result.current.isSubmitting).toBe(false)
  })
})
