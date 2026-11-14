import { act, renderHook, waitFor } from '@testing-library/react'
import { useMedicionMutation } from './useMedicionMutation'

describe('useMedicionMutation', () => {
  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useMedicionMutation(jest.fn()))
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result from the wrapped mutation on success', async () => {
    const mutate = jest.fn().mockResolvedValue({ data: 'id-1', error: null })
    const { result } = renderHook(() => useMedicionMutation(mutate))

    let returned: unknown
    await act(async () => {
      returned = await result.current.submit({ etapaId: 'e-1' })
    })

    expect(returned).toEqual({ data: 'id-1', error: null })
  })

  it('forwards the payload to the wrapped mutation', async () => {
    const mutate = jest.fn().mockResolvedValue(null)
    const { result } = renderHook(() => useMedicionMutation(mutate))

    await act(async () => {
      await result.current.submit({ etapaId: 'e-7' })
    })

    expect(mutate).toHaveBeenCalledWith({ etapaId: 'e-7' })
  })

  it('sets isSubmitting true while the mutation is in flight', async () => {
    let resolve!: (value: unknown) => void
    const mutate = jest.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { result } = renderHook(() => useMedicionMutation(mutate))

    act(() => {
      void result.current.submit({})
    })
    expect(result.current.isSubmitting).toBe(true)

    resolve(null)
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('resets isSubmitting to false even when the mutation throws', async () => {
    const mutate = jest.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMedicionMutation(mutate))

    await act(async () => {
      await expect(result.current.submit({})).rejects.toThrow('boom')
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls without firing a second mutation', async () => {
    let resolve!: (value: unknown) => void
    const mutate = jest.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { result } = renderHook(() => useMedicionMutation(mutate))

    act(() => {
      void result.current.submit({})
      void result.current.submit({})
    })

    expect(mutate.mock.calls).toHaveLength(1)

    resolve(null)
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('allows a new submit after the previous one settled', async () => {
    const mutate = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second')
    const { result } = renderHook(() => useMedicionMutation(mutate))

    await act(async () => {
      await result.current.submit({})
    })
    await act(async () => {
      await result.current.submit({})
    })

    expect(mutate.mock.calls).toHaveLength(2)
  })
})
