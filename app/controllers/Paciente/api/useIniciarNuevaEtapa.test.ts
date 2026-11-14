import { act, renderHook, waitFor } from '@testing-library/react'
import type { IniciarNuevaEtapaPayload } from '../PacienteTypes'
import { iniciarNuevaEtapa } from './iniciarNuevaEtapa'
import { useIniciarNuevaEtapa } from './useIniciarNuevaEtapa'

jest.mock('./iniciarNuevaEtapa')

describe('useIniciarNuevaEtapa', () => {
  let payload: IniciarNuevaEtapaPayload

  beforeEach(() => {
    payload = {
      pacienteId: 'paciente-uuid-1',
      causaId: 'causa-uuid-1',
      algoritmoId: 'algoritmo-uuid-1',
      modalidadId: 'modalidad-uuid-1',
      bloqueoIds: ['bloqueo-uuid-1'],
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1] }],
    }
  })

  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useIniciarNuevaEtapa())

    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('sets isSubmitting to true while the RPC call is in flight', async () => {
    let resolveRpc!: (value: {
      etapaId: string | null
      error: string | null
    }) => void
    ;(iniciarNuevaEtapa as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    act(() => {
      void result.current.submit(payload)
    })

    expect(result.current.isSubmitting).toBe(true)

    resolveRpc({ etapaId: 'uuid-abc', error: null })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('returns the IniciarNuevaEtapaResult from submit on success', async () => {
    ;(iniciarNuevaEtapa as jest.Mock).mockResolvedValue({
      etapaId: 'etapa-uuid-xyz',
      error: null,
    })

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    let returned: { etapaId: string | null; error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({
      etapaId: 'etapa-uuid-xyz',
      error: null,
    })
  })

  it('returns the IniciarNuevaEtapaResult from submit on error', async () => {
    ;(iniciarNuevaEtapa as jest.Mock).mockResolvedValue({
      etapaId: null,
      error: 'no_autorizado',
    })

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    let returned: { etapaId: string | null; error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({
      etapaId: null,
      error: 'no_autorizado',
    })
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(iniciarNuevaEtapa as jest.Mock).mockRejectedValue(
      new Error('network unreachable'),
    )

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    await act(async () => {
      await expect(result.current.submit(payload)).rejects.toThrow(
        'network unreachable',
      )
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls — second submit returns in-flight promise without firing a second RPC', async () => {
    let resolveRpc!: (value: {
      etapaId: string | null
      error: string | null
    }) => void
    ;(iniciarNuevaEtapa as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    let firstResult: unknown
    let secondResult: unknown
    act(() => {
      void result.current.submit(payload).then((r) => {
        firstResult = r
      })
      void result.current.submit(payload).then((r) => {
        secondResult = r
      })
    })

    expect((iniciarNuevaEtapa as jest.Mock).mock.calls).toHaveLength(1)

    resolveRpc({ etapaId: 'uuid-once', error: null })
    await waitFor(() => expect(firstResult).toBeTruthy())

    expect(firstResult).toEqual({ etapaId: 'uuid-once', error: null })
    expect(secondResult).toEqual({ etapaId: 'uuid-once', error: null })
    expect((iniciarNuevaEtapa as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('allows a new submit after the previous one settled', async () => {
    ;(iniciarNuevaEtapa as jest.Mock)
      .mockResolvedValueOnce({ etapaId: 'first', error: null })
      .mockResolvedValueOnce({ etapaId: 'second', error: null })

    const { result } = renderHook(() => useIniciarNuevaEtapa())

    await act(async () => {
      await result.current.submit(payload)
    })
    await act(async () => {
      await result.current.submit(payload)
    })

    expect((iniciarNuevaEtapa as jest.Mock).mock.calls).toHaveLength(2)
  })
})
