import { act, renderHook } from '@testing-library/react'
import { dispararInvitacion } from './dispararInvitacion'
import { useReenviarBienvenida } from './useReenviarBienvenida'

jest.mock('./dispararInvitacion')

const mockDisparar = dispararInvitacion as jest.Mock

describe('useReenviarBienvenida', () => {
  beforeEach(() => jest.resetAllMocks())

  it('starts with isSending false', () => {
    const { result } = renderHook(() => useReenviarBienvenida())
    expect(result.current).toEqual({
      reenviar: expect.any(Function),
      isSending: false,
    })
  })

  it('returns enviada when one message went out', async () => {
    mockDisparar.mockResolvedValue({ ok: true, enviadas: 1, error: null })
    const { result } = renderHook(() => useReenviarBienvenida())
    let r: unknown
    await act(async () => {
      r = await result.current.reenviar('p-1')
    })
    expect(r).toEqual('enviada')
    expect(mockDisparar).toHaveBeenCalledWith('p-1')
  })

  it('returns innecesaria when none was sent', async () => {
    mockDisparar.mockResolvedValue({ ok: true, enviadas: 0, error: null })
    const { result } = renderHook(() => useReenviarBienvenida())
    let r: unknown
    await act(async () => {
      r = await result.current.reenviar('p-1')
    })
    expect(r).toEqual('innecesaria')
  })

  it('returns error when the invocation failed', async () => {
    mockDisparar.mockResolvedValue({ ok: false, enviadas: null, error: 'x' })
    const { result } = renderHook(() => useReenviarBienvenida())
    let r: unknown
    await act(async () => {
      r = await result.current.reenviar('p-1')
    })
    expect(r).toEqual('error')
  })

  it('returns error when enviadas is null', async () => {
    mockDisparar.mockResolvedValue({ ok: true, enviadas: null, error: null })
    const { result } = renderHook(() => useReenviarBienvenida())
    let r: unknown
    await act(async () => {
      r = await result.current.reenviar('p-1')
    })
    expect(r).toEqual('error')
  })

  it('sets isSending while in flight and dedupes re-entrant calls', async () => {
    let resolve!: (v: unknown) => void
    mockDisparar.mockReturnValue(new Promise((res) => (resolve = res)))
    const { result } = renderHook(() => useReenviarBienvenida())

    let p1: Promise<unknown> = Promise.resolve()
    let p2: Promise<unknown> = Promise.resolve()
    act(() => {
      p1 = result.current.reenviar('p-1')
      p2 = result.current.reenviar('p-1')
    })
    expect(result.current.isSending).toEqual(true)
    expect(mockDisparar).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolve({ ok: true, enviadas: 1, error: null })
      await Promise.all([p1, p2])
    })
    expect(result.current.isSending).toEqual(false)
  })
})
