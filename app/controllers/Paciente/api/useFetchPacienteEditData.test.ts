import { act, renderHook, waitFor } from '@testing-library/react'
import type { PacienteEditData } from '../PacienteTypes'
import { fetchPacienteEditData } from './fetchPacienteEditData'
import { useFetchPacienteEditData } from './useFetchPacienteEditData'

jest.mock('./fetchPacienteEditData')

describe('useFetchPacienteEditData', () => {
  let editFixture: PacienteEditData

  beforeEach(() => {
    editFixture = {
      identidad: {
        nombre: 'Juan',
        fechaNacimiento: '1990-05-01',
        email: 'j@example.com',
        telefono: '111',
      },
      diagnostico: {
        causaId: 'causa-1',
        algoritmoId: 'algo-1',
        modalidadId: 'modalidad-1',
        bloqueoIds: ['b-1'],
        alfabetos: [{ alfabetoId: 'a-1', numeros: [1] }],
      },
      etapaId: 'etapa-activa',
      etapaFresca: true,
      tieneCuenta: false,
    }
  })

  it('stays idle with null data when pacienteId is null', async () => {
    const { result } = renderHook(() => useFetchPacienteEditData(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        data: null,
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchPacienteEditData as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() =>
      useFetchPacienteEditData('00000000-0000-0000-0000-000000000001'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        data: null,
        isLoading: false,
        error: 'boom',
      })
    })
  })

  it('clears a previous error when pacienteId becomes null', async () => {
    ;(fetchPacienteEditData as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useFetchPacienteEditData(id),
      {
        initialProps: { id: '00000000-0000-0000-0000-000000000001' } as {
          id: string | null
        },
      },
    )
    await waitFor(() => expect(result.current.error).toBe('boom'))

    rerender({ id: null })
    await waitFor(() => {
      expect(result.current).toEqual({
        data: null,
        isLoading: false,
        error: null,
      })
    })
  })

  it('ignores a late resolution from a previous pacienteId', async () => {
    let resolveFirst!: (value: {
      data: PacienteEditData | null
      error: Error | null
    }) => void
    const firstCall = new Promise<{
      data: PacienteEditData | null
      error: Error | null
    }>((resolve) => {
      resolveFirst = resolve
    })
    const staleData: PacienteEditData = {
      ...editFixture,
      etapaId: 'STALE-from-first-id',
    }
    ;(fetchPacienteEditData as jest.Mock)
      .mockReturnValueOnce(firstCall)
      .mockResolvedValueOnce({ data: editFixture, error: null })

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useFetchPacienteEditData(id),
      { initialProps: { id: '00000000-0000-0000-0000-00000000000a' } },
    )

    // Switch to a second paciente before the first fetch resolves.
    rerender({ id: '00000000-0000-0000-0000-00000000000b' })
    await waitFor(() => expect(result.current.data).toEqual(editFixture))

    // The first fetch resolves late — it must NOT overwrite the second's data.
    await act(async () => {
      resolveFirst({ data: staleData, error: null })
      await Promise.resolve()
    })

    expect(result.current.data).toEqual(editFixture)
  })

  it('returns the fetched editable data when the fetch succeeds', async () => {
    ;(fetchPacienteEditData as jest.Mock).mockResolvedValue({
      data: editFixture,
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchPacienteEditData('00000000-0000-0000-0000-000000000001'),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        data: editFixture,
        isLoading: false,
        error: null,
      })
    })
  })
})
