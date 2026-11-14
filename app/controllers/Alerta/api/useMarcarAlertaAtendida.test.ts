import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { ALERTA_TIPO } from '../AlertaTypes'
import { useMarcarAlertaAtendida } from './useMarcarAlertaAtendida'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useMarcarAlertaAtendida', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('calls marcar_alerta_atendida with the mapped rpc params', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    await act(async () => {
      await result.current.marcar(ALERTA_TIPO.SCORE_BAJO, 'nivel-1', 'p-1')
    })
    expect(rpcMock).toHaveBeenCalledWith('marcar_alerta_atendida', {
      p_tipo: ALERTA_TIPO.SCORE_BAJO,
      p_evento_ref: 'nivel-1',
      p_paciente_id: 'p-1',
    })
  })

  it('returns error:null when marcar succeeds', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    let returned: { error: string | null } | undefined
    await act(async () => {
      returned = await result.current.marcar(
        ALERTA_TIPO.SCORE_BAJO,
        'nivel-1',
        'p-1',
      )
    })
    expect(returned).toEqual({ error: null })
  })

  it('returns the rpc error message when marcar fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'no_autorizado' } })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    let returned: { error: string | null } | undefined
    await act(async () => {
      returned = await result.current.marcar(
        ALERTA_TIPO.SCORE_BAJO,
        'nivel-1',
        'p-1',
      )
    })
    expect(returned).toEqual({ error: 'no_autorizado' })
  })

  it('sets hook-level error when marcar fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'no_autorizado' } })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    await act(async () => {
      await result.current.marcar(ALERTA_TIPO.SCORE_BAJO, 'nivel-1', 'p-1')
    })
    expect(result.current.error).toBe('no_autorizado')
  })

  it('calls desmarcar_alerta_atendida with the mapped rpc params', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    await act(async () => {
      await result.current.desmarcar(ALERTA_TIPO.SCORE_BAJO, 'nivel-1', 'p-1')
    })
    expect(rpcMock).toHaveBeenCalledWith('desmarcar_alerta_atendida', {
      p_tipo: ALERTA_TIPO.SCORE_BAJO,
      p_evento_ref: 'nivel-1',
      p_paciente_id: 'p-1',
    })
  })

  it('returns error:null when desmarcar succeeds', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    let returned: { error: string | null } | undefined
    await act(async () => {
      returned = await result.current.desmarcar(
        ALERTA_TIPO.SCORE_BAJO,
        'nivel-1',
        'p-1',
      )
    })
    expect(returned).toEqual({ error: null })
  })

  it('returns the rpc error message when desmarcar fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'no_autorizado' } })
    const { result } = renderHook(() => useMarcarAlertaAtendida())
    let returned: { error: string | null } | undefined
    await act(async () => {
      returned = await result.current.desmarcar(
        ALERTA_TIPO.SCORE_BAJO,
        'nivel-1',
        'p-1',
      )
    })
    expect(returned).toEqual({ error: 'no_autorizado' })
  })

  it('sets isMarcando to true during the rpc call and false after', async () => {
    let resolveRpc!: (value: { error: null }) => void
    rpcMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useMarcarAlertaAtendida())

    act(() => {
      result.current.marcar(ALERTA_TIPO.SCORE_BAJO, 'nivel-1', 'p-1')
    })

    await waitFor(() => {
      expect(result.current.isMarcando).toBe(true)
    })

    await act(async () => {
      resolveRpc({ error: null })
    })

    expect(result.current.isMarcando).toBe(false)
  })
})
