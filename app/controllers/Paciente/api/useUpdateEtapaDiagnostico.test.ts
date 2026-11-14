import { act, renderHook, waitFor } from '@testing-library/react'
import type { UpdateEtapaDiagnosticoPayload } from '../PacienteTypes'
import { updateEtapaDiagnostico } from './updateEtapaDiagnostico'
import { useUpdateEtapaDiagnostico } from './useUpdateEtapaDiagnostico'

jest.mock('./updateEtapaDiagnostico')

describe('useUpdateEtapaDiagnostico', () => {
  let payload: UpdateEtapaDiagnosticoPayload

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
    const { result } = renderHook(() => useUpdateEtapaDiagnostico())
    expect(result.current).toEqual({
      submit: expect.any(Function),
      isSubmitting: false,
    })
  })

  it('returns the result from submit on success', async () => {
    ;(updateEtapaDiagnostico as jest.Mock).mockResolvedValue({ error: null })
    const { result } = renderHook(() => useUpdateEtapaDiagnostico())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: null })
  })

  it('returns the result from submit on error', async () => {
    ;(updateEtapaDiagnostico as jest.Mock).mockResolvedValue({
      error: 'etapa_con_progreso',
    })
    const { result } = renderHook(() => useUpdateEtapaDiagnostico())

    let returned: { error: string | null } | null = null
    await act(async () => {
      returned = await result.current.submit(payload)
    })

    expect(returned).toEqual({ error: 'etapa_con_progreso' })
  })

  it('resets isSubmitting to false even when the RPC throws', async () => {
    ;(updateEtapaDiagnostico as jest.Mock).mockRejectedValue(
      new Error('network unreachable'),
    )
    const { result } = renderHook(() => useUpdateEtapaDiagnostico())

    await act(async () => {
      await expect(result.current.submit(payload)).rejects.toThrow(
        'network unreachable',
      )
    })

    expect(result.current.isSubmitting).toBe(false)
  })

  it('deduplicates concurrent calls without firing a second RPC', async () => {
    let resolveRpc!: (value: { error: string | null }) => void
    ;(updateEtapaDiagnostico as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useUpdateEtapaDiagnostico())

    act(() => {
      void result.current.submit(payload)
      void result.current.submit(payload)
    })

    expect((updateEtapaDiagnostico as jest.Mock).mock.calls).toHaveLength(1)

    resolveRpc({ error: null })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })
})
