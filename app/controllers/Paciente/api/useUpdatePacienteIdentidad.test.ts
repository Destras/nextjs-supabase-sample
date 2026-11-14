import { act, renderHook, waitFor } from '@testing-library/react'
import type { UpdatePacienteIdentidadPayload } from '../PacienteTypes'
import { updatePacienteIdentidad } from './updatePacienteIdentidad'
import { useUpdatePacienteIdentidad } from './useUpdatePacienteIdentidad'

jest.mock('./updatePacienteIdentidad')

describe('useUpdatePacienteIdentidad', () => {
  let payload: UpdatePacienteIdentidadPayload

  beforeEach(() => {
    payload = {
      pacienteId: 'paciente-uuid-1',
      nombre: 'Ana García',
      fechaNacimiento: '1990-05-15',
      email: 'ana@example.com',
      telefono: '+34600000000',
    }
  })

  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useUpdatePacienteIdentidad())
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result from submit on success', async () => {
    ;(updatePacienteIdentidad as jest.Mock).mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUpdatePacienteIdentidad())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: null })
  })

  it('returns the result from submit on error', async () => {
    ;(updatePacienteIdentidad as jest.Mock).mockResolvedValue({
      error: 'no_autorizado',
    })
    const { result } = renderHook(() => useUpdatePacienteIdentidad())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: 'no_autorizado' })
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(updatePacienteIdentidad as jest.Mock).mockRejectedValue(
      new Error('network unreachable'),
    )
    const { result } = renderHook(() => useUpdatePacienteIdentidad())

    await act(async () => {
      await expect(result.current.submit(payload)).rejects.toThrow(
        'network unreachable',
      )
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls without firing a second RPC', async () => {
    let resolveRpc!: (value: { error: string | null }) => void
    ;(updatePacienteIdentidad as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useUpdatePacienteIdentidad())

    act(() => {
      void result.current.submit(payload)
      void result.current.submit(payload)
    })

    expect((updatePacienteIdentidad as jest.Mock).mock.calls).toHaveLength(1)

    resolveRpc({ error: null })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })
})
