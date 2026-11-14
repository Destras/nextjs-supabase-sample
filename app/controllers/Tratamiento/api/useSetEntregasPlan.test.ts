'use client'

import { act, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { serializeEntregasPlan } from '../utils/serializeEntregasPlan'
import type { SemanaContenido } from '../utils/serializeEntregasPlan'
import { useSetEntregasPlan } from './useSetEntregasPlan'

jest.mock('@/lib/supabase/client')
jest.mock('../utils/serializeEntregasPlan', () => ({
  serializeEntregasPlan: jest.fn(),
}))

describe('useSetEntregasPlan', () => {
  let rpcMock: jest.Mock
  let etapaId: string
  let semanas: ReadonlyArray<SemanaContenido>
  let serializedRows: { semana: number; orden: number; contenido_id?: string }[]

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })

    etapaId = 'etapa-uuid-1'
    semanas = [
      {
        semana: 1,
        meditacion: 'c-1',
        mantra: 'c-2',
        egregor: null,
        cma: null,
        ic: null,
      },
    ]
    serializedRows = [
      { semana: 1, orden: 1, contenido_id: 'c-1' },
      { semana: 1, orden: 2, contenido_id: 'c-2' },
    ]
    ;(serializeEntregasPlan as jest.Mock).mockReturnValue(serializedRows)
  })

  it('returns initial state with isSubmitting false and error null', () => {
    const { result } = renderHook(() => useSetEntregasPlan())

    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
      error: null,
    })
  })

  it('calls rpc with p_etapa_id and p_entregas_plan and returns ok true on success', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useSetEntregasPlan())

    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })

    expect(rpcMock).toHaveBeenCalledWith('set_entregas_plan', {
      p_etapa_id: etapaId,
      p_entregas_plan: serializedRows,
    })
  })

  it('returns { ok: true, error: null, semanaPasada: null } when the RPC succeeds', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useSetEntregasPlan())

    let returned: unknown = null
    await act(async () => {
      returned = await result.current.submit(etapaId, semanas)
    })

    expect(returned).toEqual({ ok: true, error: null, semanaPasada: null })
  })

  it('never invokes the paciente-invitacion edge function', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const invokeMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
      functions: { invoke: invokeMock },
    })

    const { result } = renderHook(() => useSetEntregasPlan())
    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })

    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('exposes the week number as semanaPasada when the RPC fails with semana_pasada', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'semana_pasada', details: '3' },
    })

    const { result } = renderHook(() => useSetEntregasPlan())

    let returned: unknown = null
    await act(async () => {
      returned = await result.current.submit(etapaId, semanas)
    })

    expect(returned).toEqual({
      ok: false,
      error: 'semana_pasada',
      semanaPasada: 3,
    })
  })

  it('returns { ok: false, error } and resets isSubmitting when the RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })

    const { result } = renderHook(() => useSetEntregasPlan())

    let returned: unknown = null
    await act(async () => {
      returned = await result.current.submit(etapaId, semanas)
    })

    expect(returned).toEqual({
      ok: false,
      error: 'no_autorizado',
      semanaPasada: null,
    })
  })

  it('resets isSubmitting to false after the RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })

    const { result } = renderHook(() => useSetEntregasPlan())

    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('sets error state after the RPC fails', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })

    const { result } = renderHook(() => useSetEntregasPlan())

    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })

    expect(result.current.error).toBe('no_autorizado')
  })

  it("persists each submit's own payload when a second overlaps the first (no stale dedup)", async () => {
    const semanasA: ReadonlyArray<SemanaContenido> = [
      {
        semana: 1,
        meditacion: 'a',
        mantra: null,
        egregor: null,
        cma: null,
        ic: null,
      },
    ]
    const semanasB: ReadonlyArray<SemanaContenido> = [
      {
        semana: 1,
        meditacion: 'b',
        mantra: null,
        egregor: null,
        cma: null,
        ic: null,
      },
    ]
    const rowsA = [{ semana: 1, orden: 1, contenido_id: 'a' }]
    const rowsB = [{ semana: 1, orden: 1, contenido_id: 'b' }]
    ;(serializeEntregasPlan as jest.Mock).mockImplementation((s) =>
      s === semanasA ? rowsA : rowsB,
    )

    let resolveFirst!: (value: { data: null; error: null }) => void
    rpcMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
      )
      .mockResolvedValue({ data: null, error: null })

    const { result } = renderHook(() => useSetEntregasPlan())

    await act(async () => {
      void result.current.submit(etapaId, semanasA)
      void result.current.submit(etapaId, semanasB)
      resolveFirst({ data: null, error: null })
    })

    // The second submit must serialize and send ITS OWN draft, not resolve
    // against the first in-flight promise.
    expect(serializeEntregasPlan).toHaveBeenCalledWith(semanasB)
    expect(rpcMock).toHaveBeenCalledTimes(2)
    expect(rpcMock).toHaveBeenLastCalledWith('set_entregas_plan', {
      p_etapa_id: etapaId,
      p_entregas_plan: rowsB,
    })
  })

  it('clears a previous error when a new submit starts', async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'no_autorizado' },
      })
      .mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useSetEntregasPlan())

    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })
    expect(result.current.error).toBe('no_autorizado')

    await act(async () => {
      await result.current.submit(etapaId, semanas)
    })
    expect(result.current.error).toBeNull()
  })
})
