import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useUpdateTerapeuta } from './useUpdateTerapeuta'
import { ROLE } from '@/app/controllers/Auth'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useUpdateTerapeuta', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('returns ok:true and the mapped terapeuta when rpc succeeds', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 't-1',
          nombre: 'Dr. Juan',
          email: 'juan@clinic.com',
          telefono: '1234',
          estado: 'activo',
          pacientes_activos: 2,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    let returnValue:
      | { ok: boolean; terapeuta?: import('../TerapeutaTypes').Terapeuta }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        nombre: 'Dr. Juan',
        telefono: '1234',
      })
    })
    expect(returnValue).toEqual({
      ok: true,
      terapeuta: {
        id: 't-1',
        role: ROLE.TERAPEUTA,
        state: TERAPEUTA_STATE.ACTIVO,
        email: 'juan@clinic.com',
        telefono: '1234',
        pacientesActivos: 2,
        profile: {
          id: 't-1',
          name: 'Dr. Juan',
          email: 'juan@clinic.com',
          role: ROLE.TERAPEUTA,
          timezone: '',
        },
      },
    })
  })

  it('returns error:null after a successful mutate', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 't-1',
          nombre: 'Dr. Juan',
          email: 'juan@clinic.com',
          telefono: null,
          estado: 'activo',
          pacientes_activos: 0,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    await act(async () => {
      await result.current.mutate({
        terapeutaId: 't-1',
        nombre: 'Dr. Juan',
        telefono: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:false and surfaces nombre_vacio when rpc returns that error code', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'nombre_vacio', code: '23514' },
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    let returnValue:
      | { ok: boolean; terapeuta?: import('../TerapeutaTypes').Terapeuta }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        nombre: '',
        telefono: null,
      })
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets error to nombre_vacio in hook state when rpc returns that error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'nombre_vacio', code: '23514' },
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    await act(async () => {
      await result.current.mutate({
        terapeutaId: 't-1',
        nombre: '',
        telefono: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'nombre_vacio',
    })
  })

  it('returns ok:false with generic error when rpc returns an unrecognised error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    let returnValue:
      | { ok: boolean; terapeuta?: import('../TerapeutaTypes').Terapeuta }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        nombre: 'Dr. Juan',
        telefono: null,
      })
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets error to update_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useUpdateTerapeuta())
    await act(async () => {
      await result.current.mutate({
        terapeutaId: 't-1',
        nombre: 'Dr. Juan',
        telefono: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'update_failed',
    })
  })

  it('sets isLoading to true during the rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useUpdateTerapeuta())

    act(() => {
      result.current.mutate({
        terapeutaId: 't-1',
        nombre: 'Dr. Juan',
        telefono: null,
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({
        data: [
          {
            id: 't-1',
            nombre: 'Dr. Juan',
            email: '',
            telefono: null,
            estado: 'activo',
            pacientes_activos: 0,
          },
        ],
        error: null,
      })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
