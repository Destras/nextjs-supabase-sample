import { act, renderHook } from '@testing-library/react'
import {
  useCountContenidoUsage,
  useDeleteContenido,
  useReplaceAndDeleteContenido,
} from '@/app/controllers/Contenido'
import { toast } from 'sonner'
import { useContenidoMutations } from './useContenidoMutations'
import type { CatalogItem } from './catalogItem'

jest.mock('@/app/controllers/Contenido', () => ({
  ...jest.requireActual('@/app/controllers/Contenido'),
  useCountContenidoUsage: jest.fn(),
  useDeleteContenido: jest.fn(),
  useReplaceAndDeleteContenido: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe('useContenidoMutations', () => {
  const countMutateMock = jest.fn()
  const deleteMutateMock = jest.fn()
  const replaceMutateMock = jest.fn()

  const itemA: CatalogItem = {
    id: 'c-1',
    source: 'contenido',
    tab: 'videos',
    nombre: 'Video A',
    descripcion: null,
    isPlayable: false,
    duracionSeg: null,
  }
  const itemB: CatalogItem = {
    id: 'c-2',
    source: 'contenido',
    tab: 'videos',
    nombre: 'Video B',
    descripcion: null,
    isPlayable: false,
    duracionSeg: null,
  }
  const itemC: CatalogItem = {
    id: 'c-3',
    source: 'contenido',
    tab: 'videos',
    nombre: 'Video C',
    descripcion: null,
    isPlayable: false,
    duracionSeg: null,
  }

  const refreshMock = jest.fn()

  beforeEach(() => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: true })
    replaceMutateMock.mockResolvedValue({ ok: true, affected: 2 })
    ;(useCountContenidoUsage as jest.Mock).mockReturnValue({
      mutate: countMutateMock,
      isLoading: false,
      error: null,
    })
    ;(useDeleteContenido as jest.Mock).mockReturnValue({
      mutate: deleteMutateMock,
      isLoading: false,
      error: null,
    })
    ;(useReplaceAndDeleteContenido as jest.Mock).mockReturnValue({
      mutate: replaceMutateMock,
      isLoading: false,
      error: null,
    })
  })

  // --- initial state ---

  it('deleteTarget starts as null', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.deleteTarget).toBeNull()
  })

  it('replaceTarget starts as null', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.replaceTarget).toBeNull()
  })

  it('affectedCount starts as 0', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.affectedCount).toBe(0)
  })

  it('candidates starts as empty array', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.candidates).toEqual([])
  })

  it('selectedReplacementId starts as null', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.selectedReplacementId).toBeNull()
  })

  it('deleteError starts as null', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.deleteError).toBeNull()
  })

  it('replaceError starts as null', () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    expect(result.current.replaceError).toBeNull()
  })

  // --- onAskDelete: count = 0 → simple delete ---

  it('onAskDelete with count 0 sets deleteTarget to the item', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.deleteTarget).toEqual(itemA)
  })

  it('onAskDelete with count 0 keeps replaceTarget as null', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.replaceTarget).toBeNull()
  })

  // --- onAskDelete: count > 0 → replace path ---

  it('onAskDelete with count > 0 sets replaceTarget to the item', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 3 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.replaceTarget).toEqual(itemA)
  })

  it('onAskDelete with count > 0 sets affectedCount', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 3 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.affectedCount).toBe(3)
  })

  it('onAskDelete with count > 0 keeps deleteTarget as null', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 3 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  // --- candidates filtering ---

  it('candidates excludes the item being deleted', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 3 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.candidates).toEqual([itemB, itemC])
  })

  it('candidates is empty when the only item is the one being deleted', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 1 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.candidates).toEqual([])
  })

  it('opens replaceTarget even when candidates is empty', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 1 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.replaceTarget).toEqual(itemA)
  })

  // --- onConfirmDelete: success ---

  it('onConfirmDelete on success calls toast.success with Contenido eliminado.', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(toast.success).toHaveBeenCalledWith('Contenido eliminado.')
  })

  it('onConfirmDelete on success clears deleteTarget', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  it('onConfirmDelete on success calls refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  // --- onConfirmDelete: generic error ---

  it('onConfirmDelete on generic error sets deleteError', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({
      ok: false,
      error: 'delete_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteError).toBe(
      'No pudimos eliminar el contenido. Intentá de nuevo.',
    )
  })

  it('onConfirmDelete on generic error keeps deleteTarget open', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({
      ok: false,
      error: 'delete_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteTarget).toEqual(itemA)
  })

  it('onConfirmDelete on generic error does not call refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({
      ok: false,
      error: 'delete_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  // --- onConfirmDelete: no_encontrado ---

  it('onConfirmDelete with no_encontrado sets copy and calls refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'no_encontrado' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteError).toBe(
      'No encontramos el contenido. Puede que ya haya sido eliminado.',
    )
  })

  it('onConfirmDelete with no_encontrado calls refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'no_encontrado' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  // --- onConfirmDelete: en_uso (race condition) ---

  it('onConfirmDelete with en_uso surfaces the copy via replaceError (CON-022)', async () => {
    // The race reopens the replace-dialog, which renders `replaceError`. The
    // explanatory copy must land there (not deleteError, whose dialog is closed).
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'en_uso' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.replaceError).toBe(
      'Este contenido se asignó a un paciente mientras lo eliminabas. Volvé a intentar.',
    )
    // deleteError is not the shown channel here (its dialog is closed).
    expect(result.current.deleteError).toBeNull()
  })

  it('onConfirmDelete with en_uso opens replaceTarget (race reopens replace path)', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'en_uso' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.replaceTarget).toEqual(itemA)
  })

  it('onConfirmDelete with en_uso re-queries the count and sets affectedCount to the real value (CON-021)', async () => {
    // count is 0 at onAskDelete time, then the item gets assigned (race) so the
    // recount inside the en_uso branch returns >= 1.
    countMutateMock
      .mockResolvedValueOnce({ ok: true, count: 0 })
      .mockResolvedValueOnce({ ok: true, count: 4 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'en_uso' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.affectedCount).toBe(4)
  })

  it('onConfirmDelete with en_uso floors affectedCount at 1 when the recount fails (CON-021)', async () => {
    countMutateMock
      .mockResolvedValueOnce({ ok: true, count: 0 })
      .mockResolvedValueOnce({ ok: false, error: 'no_autorizado' })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'en_uso' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.affectedCount).toBeGreaterThanOrEqual(1)
  })

  it('onConfirmDelete with en_uso clears deleteTarget', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'en_uso' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  // --- onConfirmDelete: tipo_distinto → generic bucket ---

  it('onConfirmDelete with tipo_distinto sets generic delete error copy', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'tipo_distinto' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteError).toBe(
      'No pudimos eliminar el contenido. Intentá de nuevo.',
    )
  })

  // --- onConfirmDelete: no_autorizado → generic bucket ---

  it('onConfirmDelete with no_autorizado sets generic delete error copy', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({ ok: false, error: 'no_autorizado' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(result.current.deleteError).toBe(
      'No pudimos eliminar el contenido. Intentá de nuevo.',
    )
  })

  // --- onSelectReplacement ---

  it('onSelectReplacement sets selectedReplacementId', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    expect(result.current.selectedReplacementId).toBe(itemB.id)
  })

  // --- onConfirmReplace: success ---

  it('onConfirmReplace on success calls toast.success with affected count', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({ ok: true, affected: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(toast.success).toHaveBeenCalledWith(
      'Reemplazamos el contenido en 2 pacientes y eliminamos el original.',
    )
  })

  it('onConfirmReplace on success says "1 paciente" when a single paciente was affected', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 1 })
    replaceMutateMock.mockResolvedValue({ ok: true, affected: 1 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(toast.success).toHaveBeenCalledWith(
      'Reemplazamos el contenido en 1 paciente y eliminamos el original.',
    )
  })

  it('onConfirmReplace on success clears replaceTarget', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({ ok: true, affected: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(result.current.replaceTarget).toBeNull()
  })

  it('onConfirmReplace on success calls refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({ ok: true, affected: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  // --- onConfirmReplace: error ---

  it('onConfirmReplace on error sets replaceError copy', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({
      ok: false,
      error: 'replace_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(result.current.replaceError).toBe(
      'No pudimos completar el reemplazo. No se eliminó nada. Intentá de nuevo.',
    )
  })

  it('onConfirmReplace on error keeps replaceTarget open', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({
      ok: false,
      error: 'replace_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(result.current.replaceTarget).toEqual(itemA)
  })

  it('onConfirmReplace on error preserves selectedReplacementId', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({
      ok: false,
      error: 'replace_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(result.current.selectedReplacementId).toBe(itemB.id)
  })

  it('onConfirmReplace on error does not call refresh', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({
      ok: false,
      error: 'replace_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(refreshMock).not.toHaveBeenCalled()
  })

  // --- close handlers ---

  it('onCloseDelete clears deleteTarget', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onCloseDelete()
    })
    expect(result.current.deleteTarget).toBeNull()
  })

  it('onCloseDelete clears deleteError', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 0 })
    deleteMutateMock.mockResolvedValue({
      ok: false,
      error: 'delete_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    act(() => {
      result.current.onCloseDelete()
    })
    expect(result.current.deleteError).toBeNull()
  })

  it('onCloseReplace clears replaceTarget', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onCloseReplace()
    })
    expect(result.current.replaceTarget).toBeNull()
  })

  it('onCloseReplace clears selectedReplacementId', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    act(() => {
      result.current.onCloseReplace()
    })
    expect(result.current.selectedReplacementId).toBeNull()
  })

  it('onCloseReplace clears replaceError', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    replaceMutateMock.mockResolvedValue({
      ok: false,
      error: 'replace_contenido_failed',
    })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onSelectReplacement(itemB.id)
    })
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    act(() => {
      result.current.onCloseReplace()
    })
    expect(result.current.replaceError).toBeNull()
  })

  it('onCloseReplace clears affectedCount back to 0', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 5 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onCloseReplace()
    })
    expect(result.current.affectedCount).toBe(0)
  })

  it('onCloseReplace clears candidates back to empty array', async () => {
    countMutateMock.mockResolvedValue({ ok: true, count: 2 })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    act(() => {
      result.current.onCloseReplace()
    })
    expect(result.current.candidates).toEqual([])
  })

  // --- no-ops when !isAdmin ---

  it('onAskDelete does nothing when isAdmin is false', async () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: false,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.deleteTarget).toBeNull()
    expect(result.current.replaceTarget).toBeNull()
    expect(countMutateMock).not.toHaveBeenCalled()
  })

  it('onConfirmDelete does nothing when isAdmin is false', async () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: false,
      }),
    )
    await act(async () => {
      await result.current.onConfirmDelete()
    })
    expect(deleteMutateMock).not.toHaveBeenCalled()
  })

  it('onConfirmReplace does nothing when isAdmin is false', async () => {
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB],
        refresh: refreshMock,
        isAdmin: false,
      }),
    )
    await act(async () => {
      await result.current.onConfirmReplace()
    })
    expect(replaceMutateMock).not.toHaveBeenCalled()
  })

  it('shows an error toast when the count RPC fails on onAskDelete (CON-015)', async () => {
    countMutateMock.mockResolvedValue({ ok: false, error: 'no_autorizado' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(toast.error).toHaveBeenCalled()
  })

  it('opens no dialog when the count RPC fails on onAskDelete (CON-015)', async () => {
    countMutateMock.mockResolvedValue({ ok: false, error: 'no_autorizado' })
    const { result } = renderHook(() =>
      useContenidoMutations({
        items: [itemA, itemB, itemC],
        refresh: refreshMock,
        isAdmin: true,
      }),
    )
    await act(async () => {
      await result.current.onAskDelete(itemA)
    })
    expect(result.current.deleteTarget).toBeNull()
  })
})
