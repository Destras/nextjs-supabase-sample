import { act, renderHook } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  useFetchAlertasTerapeuta,
  useMarcarAlertaAtendida,
  ALERTA_TIPO,
} from '@/app/controllers/Alerta'
import type { Alerta, TipoAlerta } from '@/app/controllers/Alerta'
import { useAlertasCountValue } from '@/components/alertas'
import { useAlertasViewModel } from './useAlertasViewModel'

jest.mock('next/navigation')
jest.mock('@/app/controllers/Alerta', () => ({
  ...jest.requireActual('@/app/controllers/Alerta'),
  useFetchAlertasTerapeuta: jest.fn(),
  useFetchTiposAlerta: jest.fn(),
  useMarcarAlertaAtendida: jest.fn(),
}))
jest.mock('@/components/alertas', () => ({
  useAlertasCountValue: jest.fn(),
}))
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}))

const buildAlerta = (overrides: Partial<Alerta> = {}): Alerta => ({
  tipo: ALERTA_TIPO.SCORE_BAJO,
  prioridad: 'alta',
  pacienteId: 'p-1',
  pacienteNombre: 'Juan',
  terapeutaId: 't-1',
  terapeutaNombre: null,
  nombre: 'Score bajo',
  icono: 'trending-down',
  mensaje: 'El score cayó',
  eventoRef: 'ev-1',
  fecha: '2026-07-01',
  descartable: true,
  ...overrides,
})

const buildTipo = (overrides: Partial<TipoAlerta> = {}): TipoAlerta => ({
  codigo: 'score_bajo',
  nombre: 'Score bajo',
  prioridad: 'alta',
  orden: 1,
  icono: 'trending-down',
  descripcion: null,
  activo: true,
  descartable: true,
  ...overrides,
})

describe('useAlertasViewModel', () => {
  let pushMock: jest.Mock
  let marcarMock: jest.Mock
  let desmarcarMock: jest.Mock
  let adjustMock: jest.Mock

  beforeEach(() => {
    pushMock = jest.fn()
    marcarMock = jest.fn().mockResolvedValue({ error: null })
    desmarcarMock = jest.fn().mockResolvedValue({ error: null })
    adjustMock = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push: pushMock })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    ;(useMarcarAlertaAtendida as jest.Mock).mockReturnValue({
      marcar: marcarMock,
      desmarcar: desmarcarMock,
      isMarcando: false,
      error: null,
    })
    ;(useAlertasCountValue as jest.Mock).mockReturnValue({
      count: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      adjust: adjustMock,
    })
  })

  it('sorts alertas by prioridad, alta before media, preserving relative order within the same prioridad', () => {
    const mediaUno = buildAlerta({
      eventoRef: 'ev-media-1',
      prioridad: 'media',
    })
    const alta = buildAlerta({ eventoRef: 'ev-alta', prioridad: 'alta' })
    const mediaDos = buildAlerta({
      eventoRef: 'ev-media-2',
      prioridad: 'media',
    })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [mediaUno, alta, mediaDos],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.alertas).toEqual([alta, mediaUno, mediaDos])
  })

  it('within the same prioridad, orders by fecha desc', () => {
    const vieja = buildAlerta({ eventoRef: 'ev-a', fecha: '2026-06-01' })
    const nueva = buildAlerta({ eventoRef: 'ev-b', fecha: '2026-07-01' })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [vieja, nueva],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.alertas).toEqual([nueva, vieja])
  })

  it('within the same prioridad, sorts alertas with a null fecha to the end', () => {
    const sinFecha = buildAlerta({ eventoRef: 'ev-null', fecha: null })
    const conFecha = buildAlerta({ eventoRef: 'ev-fecha', fecha: '2026-06-01' })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [sinFecha, conFecha],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.alertas).toEqual([conFecha, sinFecha])
  })

  it('breaks ties deterministically by eventoRef when prioridad and fecha match', () => {
    const zeta = buildAlerta({ eventoRef: 'ev-z', fecha: '2026-07-01' })
    const alfa = buildAlerta({ eventoRef: 'ev-a', fecha: '2026-07-01' })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [zeta, alfa],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.alertas).toEqual([alfa, zeta])
  })

  it('breaks ties deterministically by eventoRef among null-fecha alertas', () => {
    const zeta = buildAlerta({ eventoRef: 'ev-z', fecha: null })
    const alfa = buildAlerta({ eventoRef: 'ev-a', fecha: null })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [zeta, alfa],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.alertas).toEqual([alfa, zeta])
  })

  it('yields the same order regardless of the incoming array order (stable across reads)', () => {
    const a1 = buildAlerta({ eventoRef: 'ev-1', fecha: '2026-07-03' })
    const a2 = buildAlerta({ eventoRef: 'ev-2', fecha: '2026-07-01' })
    const a3 = buildAlerta({ eventoRef: 'ev-3', fecha: null })
    const expected = [a1, a2, a3]
    for (const incoming of [
      [a1, a2, a3],
      [a3, a2, a1],
      [a2, a1, a3],
    ]) {
      ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
        alertas: incoming,
        tipos: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })
      const { result } = renderHook(() => useAlertasViewModel())
      expect(result.current.alertas).toEqual(expected)
    }
  })

  it('onFiltrar(tipo) narrows the list to only that tipo', () => {
    const scoreBajo = buildAlerta({
      eventoRef: 'ev-1',
      tipo: ALERTA_TIPO.SCORE_BAJO,
    })
    const evalVencida = buildAlerta({
      eventoRef: 'ev-2',
      tipo: ALERTA_TIPO.EVAL_VENCIDA,
    })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [scoreBajo, evalVencida],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onFiltrar(ALERTA_TIPO.EVAL_VENCIDA)
    })
    expect(result.current.alertas).toEqual([evalVencida])
  })

  it('onFiltrar(null) ("Todas") returns to showing every alerta, still sorted by prioridad', () => {
    const media = buildAlerta({ eventoRef: 'ev-media', prioridad: 'media' })
    const alta = buildAlerta({
      eventoRef: 'ev-alta',
      prioridad: 'alta',
      tipo: ALERTA_TIPO.MES_3,
    })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [media, alta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onFiltrar(ALERTA_TIPO.MES_3)
    })
    act(() => {
      result.current.onFiltrar(null)
    })
    expect(result.current.alertas).toEqual([alta, media])
  })

  it('countsPorTipo counts per tipo across the full caseload, unaffected by the current filtroTipo', () => {
    const scoreBajoUno = buildAlerta({
      eventoRef: 'ev-1',
      tipo: ALERTA_TIPO.SCORE_BAJO,
    })
    const scoreBajoDos = buildAlerta({
      eventoRef: 'ev-2',
      tipo: ALERTA_TIPO.SCORE_BAJO,
    })
    const mes3 = buildAlerta({ eventoRef: 'ev-3', tipo: ALERTA_TIPO.MES_3 })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [scoreBajoUno, scoreBajoDos, mes3],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onFiltrar(ALERTA_TIPO.MES_3)
    })
    expect(result.current.countsPorTipo).toEqual({
      [ALERTA_TIPO.SCORE_BAJO]: 2,
      [ALERTA_TIPO.MES_3]: 1,
    })
  })

  it('onMarcar removes the alerta from the list immediately, before marcar resolves', () => {
    marcarMock.mockReturnValue(new Promise(() => {}))
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onMarcar(alerta)
    })
    expect(result.current.alertas).toEqual([])
  })

  it('onMarcar removes only the marked alerta, not another sharing the same eventoRef but a different tipo/pacienteId', () => {
    marcarMock.mockReturnValue(new Promise(() => {}))
    const marcada = buildAlerta({
      tipo: ALERTA_TIPO.SCORE_BAJO,
      eventoRef: 'ev-shared',
      pacienteId: 'p-1',
    })
    const gemela = buildAlerta({
      tipo: ALERTA_TIPO.EVAL_VENCIDA,
      eventoRef: 'ev-shared',
      pacienteId: 'p-2',
    })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [marcada, gemela],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onMarcar(marcada)
    })
    expect(result.current.alertas).toEqual([gemela])
  })

  it('onMarcar calls adjust(-1) on the shared count right after the optimistic removal', () => {
    marcarMock.mockReturnValue(new Promise(() => {}))
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onMarcar(alerta)
    })
    expect(adjustMock).toHaveBeenCalledWith(-1)
  })

  it('onMarcar shows a toast with a "Deshacer" action when marcar resolves without error', async () => {
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    expect(toast).toHaveBeenCalledWith(
      'Alerta marcada como atendida.',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Deshacer' }),
      }),
    )
  })

  it('onMarcar re-adds the alerta (rollback) when marcar resolves with an error', async () => {
    marcarMock.mockResolvedValue({ error: 'boom' })
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    expect(result.current.alertas).toEqual([alerta])
  })

  it('onMarcar calls adjust(+1) as part of the rollback when marcar resolves with an error', async () => {
    marcarMock.mockResolvedValue({ error: 'boom' })
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    expect(adjustMock).toHaveBeenCalledWith(1)
  })

  it('onMarcar shows toast.error when marcar resolves with an error', async () => {
    marcarMock.mockResolvedValue({ error: 'boom' })
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos marcar la alerta. Intentá de nuevo.',
    )
  })

  it('the "Deshacer" toast action calls desmarcar with (tipo, eventoRef, pacienteId)', async () => {
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    const [, options] = (toast as unknown as jest.Mock).mock.calls[0]
    act(() => {
      options.action.onClick()
    })
    expect(desmarcarMock).toHaveBeenCalledWith(
      alerta.tipo,
      alerta.eventoRef,
      alerta.pacienteId,
    )
  })

  it('the "Deshacer" toast action re-adds the alerta to the list', async () => {
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    const [, options] = (toast as unknown as jest.Mock).mock.calls[0]
    act(() => {
      options.action.onClick()
    })
    expect(result.current.alertas).toEqual([alerta])
  })

  it('the "Deshacer" toast action calls adjust(+1) on the shared count', async () => {
    const alerta = buildAlerta()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alerta],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    await act(async () => {
      await result.current.onMarcar(alerta)
    })
    const [, options] = (toast as unknown as jest.Mock).mock.calls[0]
    act(() => {
      options.action.onClick()
    })
    expect(adjustMock).toHaveBeenCalledWith(1)
  })

  it('onOpenPaciente pushes to /pacientes/[id]/camino', () => {
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onOpenPaciente('p-9')
    })
    expect(pushMock).toHaveBeenCalledWith('/pacientes/p-9/camino')
  })

  it('onOpenPaciente deep-links medicion_cierre_pendiente to ?finalizar=1', () => {
    const alerta = buildAlerta({ tipo: ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE })
    const { result } = renderHook(() => useAlertasViewModel())
    act(() => {
      result.current.onOpenPaciente('p-9', alerta)
    })
    expect(pushMock).toHaveBeenCalledWith('/pacientes/p-9/camino?finalizar=1')
  })

  it('passes through tipos from useFetchAlertasTerapeuta', () => {
    const tipo = buildTipo()
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [tipo],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.tipos).toEqual([tipo])
  })

  it('reports isLoading true while alertas are still fetching', () => {
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('surfaces the error from useFetchAlertasTerapeuta', () => {
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [],
      isLoading: false,
      error: 'fetch failed',
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.error).toBe('fetch failed')
  })

  it('starts with filtroTipo null', () => {
    const { result } = renderHook(() => useAlertasViewModel())
    expect(result.current.filtroTipo).toBeNull()
  })
})
