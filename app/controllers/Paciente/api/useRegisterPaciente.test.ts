import { act, renderHook, waitFor } from '@testing-library/react'
import type { RegisterPacientePayload } from '../PacienteTypes'
import { registerPaciente } from './registerPaciente'
import { useRegisterPaciente } from './useRegisterPaciente'

jest.mock('./registerPaciente')

describe('useRegisterPaciente', () => {
  let payload: RegisterPacientePayload

  beforeEach(() => {
    payload = {
      nombre: 'Ana García',
      fechaNacimiento: '1990-05-15',
      email: 'ana@example.com',
      telefono: '+34600000000',
      causaId: 'causa-uuid-1',
      algoritmoId: 'algoritmo-uuid-1',
      modalidadId: 'modalidad-uuid-1',
      bloqueoIds: ['bloqueo-uuid-1'],
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1] }],
    }
  })

  it('returns initial state with isSubmitting false', () => {
    const { result } = renderHook(() => useRegisterPaciente())

    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('sets isSubmitting to true while the RPC call is in flight', async () => {
    let resolveRpc!: (value: {
      pacienteId: string | null
      error: string | null
    }) => void
    ;(registerPaciente as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    const { result } = renderHook(() => useRegisterPaciente())

    act(() => {
      void result.current.submit(payload)
    })

    expect(result.current.isSubmitting).toBe(true)

    resolveRpc({ pacienteId: 'uuid-abc', error: null })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it('returns the RegisterPacienteResult from submit on success', async () => {
    ;(registerPaciente as jest.Mock).mockResolvedValue({
      pacienteId: 'paciente-uuid-xyz',
      error: null,
    })

    const { result } = renderHook(() => useRegisterPaciente())

    let returned: { pacienteId: string | null; error: string | null } | null =
      null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({
      pacienteId: 'paciente-uuid-xyz',
      error: null,
    })
  })

  it('returns the RegisterPacienteResult from submit on error', async () => {
    ;(registerPaciente as jest.Mock).mockResolvedValue({
      pacienteId: null,
      error: 'no_autorizado',
    })

    const { result } = renderHook(() => useRegisterPaciente())

    let returned: { pacienteId: string | null; error: string | null } | null =
      null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({
      pacienteId: null,
      error: 'no_autorizado',
    })
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(registerPaciente as jest.Mock).mockRejectedValue(
      new Error('network unreachable'),
    )

    const { result } = renderHook(() => useRegisterPaciente())

    await act(async () => {
      await expect(result.current.submit(payload)).rejects.toThrow(
        'network unreachable',
      )
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls — second submit returns in-flight promise without firing a second RPC', async () => {
    let resolveRpc!: (value: {
      pacienteId: string | null
      error: string | null
    }) => void
    ;(registerPaciente as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    const { result } = renderHook(() => useRegisterPaciente())

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

    expect((registerPaciente as jest.Mock).mock.calls).toHaveLength(1)

    resolveRpc({ pacienteId: 'uuid-once', error: null })
    await waitFor(() => expect(firstResult).toBeTruthy())

    expect(firstResult).toEqual({ pacienteId: 'uuid-once', error: null })
    expect(secondResult).toEqual({ pacienteId: 'uuid-once', error: null })
    expect((registerPaciente as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('allows a new submit after the previous one settled', async () => {
    ;(registerPaciente as jest.Mock)
      .mockResolvedValueOnce({ pacienteId: 'first', error: null })
      .mockResolvedValueOnce({ pacienteId: 'second', error: null })

    const { result } = renderHook(() => useRegisterPaciente())

    await act(async () => {
      await result.current.submit(payload)
    })
    await act(async () => {
      await result.current.submit(payload)
    })

    expect((registerPaciente as jest.Mock).mock.calls).toHaveLength(2)
  })
})
