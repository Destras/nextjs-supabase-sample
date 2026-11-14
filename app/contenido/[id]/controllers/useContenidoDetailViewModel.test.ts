import { renderHook, act } from '@testing-library/react'
import {
  useFetchContenidoById,
  useFetchAllContenido,
  useFetchContenidoMediaUrl,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import type { Contenido } from '@/app/controllers/Contenido'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useContenidoMutations } from '@/app/contenido/controllers/useContenidoMutations'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseCatalogQuery } from '@/app/contenido/controllers/utils/parseCatalogQuery'
import { useContenidoDetailViewModel } from './useContenidoDetailViewModel'

jest.mock('@/app/controllers/Contenido', () => ({
  ...jest.requireActual('@/app/controllers/Contenido'),
  useFetchContenidoById: jest.fn(),
  useFetchAllContenido: jest.fn(),
  useFetchContenidoMediaUrl: jest.fn(),
}))

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

jest.mock('@/app/contenido/controllers/useContenidoMutations', () => ({
  useContenidoMutations: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

const mutationsStub = {
  deleteTarget: null,
  replaceTarget: null,
  affectedCount: 0,
  candidates: [],
  selectedReplacementId: null,
  isCounting: false,
  isDeleting: false,
  isReplacing: false,
  deleteError: null,
  replaceError: null,
  onAskDelete: jest.fn(),
  onConfirmDelete: jest.fn(),
  onSelectReplacement: jest.fn(),
  onConfirmReplace: jest.fn(),
  onCloseDelete: jest.fn(),
  onCloseReplace: jest.fn(),
}

describe('useContenidoDetailViewModel', () => {
  let videoFixture: Contenido
  let audioFixture: Contenido

  beforeEach(() => {
    jest.clearAllMocks()

    videoFixture = {
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Mi Video',
      descripcion: 'desc video',
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
    audioFixture = {
      id: 'c-2',
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Mi Mantra',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(''))
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-1',
        name: 'Admin',
        role: ROLE.ADMIN,
        timezone: 'UTC',
        email: 'admin@test.com',
      },
      isLoading: false,
      error: null,
    })
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: videoFixture,
      isLoading: false,
      error: null,
    })
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [videoFixture, audioFixture],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    ;(useContenidoMutations as jest.Mock).mockReturnValue(mutationsStub)
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: null,
      isLoading: false,
      error: null,
      retry: jest.fn(),
    })
  })

  it('fetches by contenido id for a video tipo', () => {
    renderHook(() => useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }))

    expect(useFetchContenidoById).toHaveBeenCalledWith('c-1')
  })

  it('exposes the contenido as item for a video tipo', () => {
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.item).toBe(videoFixture)
  })

  it('returns notFound true when the item resolves to null and role is resolved', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.notFound).toBe(true)
  })

  it('returns notFound false while still loading', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.notFound).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('builds back and edit hrefs for a video tipo', () => {
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.backHref).toBe('/contenido/videos')
    expect(result.current.editHref).toBe('/contenido/c-1/editar?tipo=videos')
  })

  it('reflects the profile role in isAdmin', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-2',
        name: 'Terapeuta',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'terapeuta@test.com',
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.isAdmin).toBe(false)
  })

  it('wires useContenidoMutations with only same-type items for egregores', () => {
    const egregorFixture: Contenido = {
      id: 'c-3',
      tipo: TIPO_CONTENIDO.EGREGOR,
      titulo: 'Mi Egregor',
      descripcion: 'desc',
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: egregorFixture,
      isLoading: false,
      error: null,
    })
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [videoFixture, audioFixture, egregorFixture],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-3', tipo: 'egregores' }),
    )

    expect(useContenidoMutations).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            id: 'c-3',
            source: 'contenido',
            tab: 'egregores',
            nombre: 'Mi Egregor',
            descripcion: 'desc',
            isPlayable: false,
            duracionSeg: null,
          },
        ],
      }),
    )
  })

  it('builds back and edit hrefs for a cma tipo', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: {
        id: 'c-4',
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Mi CMA',
        descripcion: null,
        contenido: { recursoRef: null, duracion: null },
        imagenes: [],
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-4', tipo: 'cma' }),
    )

    expect(result.current.backHref).toBe('/contenido/cma')
    expect(result.current.editHref).toBe('/contenido/c-4/editar?tipo=cma')
  })

  it('wires useContenidoMutations with only same-type items for videos', () => {
    renderHook(() => useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }))

    expect(useContenidoMutations).toHaveBeenCalledWith(
      expect.objectContaining({
        isAdmin: true,
        items: [
          {
            id: 'c-1',
            source: 'contenido',
            tab: 'videos',
            nombre: 'Mi Video',
            descripcion: 'desc video',
            isPlayable: false,
            duracionSeg: null,
          },
        ],
      }),
    )
  })

  // BETA-044: `/contenido/<id>` sin `?tipo=` llega con 'videos' por defecto. El
  // tipo que vale es el del contenido cargado, no el de la URL.
  it('builds the back href from the loaded contenido when the tipo param disagrees', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: audioFixture,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-2', tipo: 'videos' }),
    )

    expect(result.current.backHref).toBe('/contenido/mantras')
  })

  it('builds the edit href from the loaded contenido when the tipo param disagrees', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: audioFixture,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-2', tipo: 'videos' }),
    )

    expect(result.current.editHref).toBe('/contenido/c-2/editar?tipo=mantras')
  })

  it('offers replacement candidates of the loaded contenido type, not of the tipo param', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: audioFixture,
      isLoading: false,
      error: null,
    })
    renderHook(() => useContenidoDetailViewModel({ id: 'c-2', tipo: 'videos' }))

    expect(useContenidoMutations).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            id: 'c-2',
            source: 'contenido',
            tab: 'mantras',
            nombre: 'Mi Mantra',
            descripcion: null,
            isPlayable: false,
            duracionSeg: null,
          },
        ],
      }),
    )
  })

  it('falls back to the tipo param while the contenido has not loaded', () => {
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-9', tipo: 'cma' }),
    )

    expect(result.current.backHref).toBe('/contenido/cma')
  })

  it('spreads the mutations result into the returned view model', () => {
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.onAskDelete).toBe(mutationsStub.onAskDelete)
    expect(result.current.onConfirmDelete).toBe(mutationsStub.onConfirmDelete)
  })

  it('exposes currentItem as the mapped catalog item', () => {
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.currentItem).toEqual({
      id: 'c-1',
      source: 'contenido',
      tab: 'videos',
      nombre: 'Mi Video',
      descripcion: 'desc video',
      isPlayable: false,
      duracionSeg: null,
    })
  })

  it('exposes hasArchivo true and playerSrc from hook when media item has recursoRef', () => {
    const videoWithRef: Contenido = {
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Mi Video',
      descripcion: 'desc',
      contenido: { recursoRef: 'videos/c-1.mp4', duracion: 120 },
      imagenes: [],
    }
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: videoWithRef,
      isLoading: false,
      error: null,
    })
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: 'https://cdn.example.com/signed-url',
      isLoading: false,
      error: null,
      retry: jest.fn(),
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.hasArchivo).toBe(true)
    expect(result.current.playerSrc).toBe('https://cdn.example.com/signed-url')
  })

  it('exposes hasArchivo true for an EGREGOR item with a recursoRef (reuses the video pipeline)', () => {
    const egregorWithRef: Contenido = {
      id: 'c-3',
      tipo: TIPO_CONTENIDO.EGREGOR,
      titulo: 'Mi Egregor',
      descripcion: 'desc',
      contenido: { recursoRef: 'egregores/c-3.mp4', duracion: 60 },
      imagenes: [],
    }
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: egregorWithRef,
      isLoading: false,
      error: null,
    })
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: 'https://cdn.example.com/egregor-url',
      isLoading: false,
      error: null,
      retry: jest.fn(),
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-3', tipo: 'egregores' }),
    )

    expect(result.current.hasArchivo).toBe(true)
    expect(result.current.playerSrc).toBe('https://cdn.example.com/egregor-url')
  })

  it('exposes hasArchivo false for a CMA gallery item (no recursoRef, carousel is PR3)', () => {
    const cmaFixture: Contenido = {
      id: 'c-4',
      tipo: TIPO_CONTENIDO.CMA,
      titulo: 'Mi Galeria',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [{ path: 'cma/x.jpg', orden: 1 }],
    }
    ;(useFetchContenidoById as jest.Mock).mockReturnValue({
      contenido: cmaFixture,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-4', tipo: 'cma' }),
    )

    expect(result.current.hasArchivo).toBe(false)
  })

  it('exposes hasArchivo false when media item has recursoRef null', () => {
    // videoFixture already has recursoRef: null (set in beforeEach)
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.hasArchivo).toBe(false)
  })

  it('threads the hook signed-url error through playerError', () => {
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: null,
      isLoading: false,
      error: 'signed_url_failed',
      retry: jest.fn(),
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.playerError).toBe('signed_url_failed')
  })

  it('sets playerError when the media element reports a playback error', () => {
    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    expect(result.current.playerError).toBeNull()

    act(() => {
      result.current.onPlaybackError()
    })

    expect(result.current.playerError).toBe('media_playback_failed')
  })

  it('lets the hook signed-url error take precedence over a playback error', () => {
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: null,
      isLoading: false,
      error: 'signed_url_failed',
      retry: jest.fn(),
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    act(() => {
      result.current.onPlaybackError()
    })

    expect(result.current.playerError).toBe('signed_url_failed')
  })

  it('clears the playback error and re-triggers the hook retry on onPlayerRetry', () => {
    const onRetryMock = jest.fn()
    ;(useFetchContenidoMediaUrl as jest.Mock).mockReturnValue({
      src: 'https://cdn.example.com/signed-url',
      isLoading: false,
      error: null,
      retry: onRetryMock,
    })

    const { result } = renderHook(() =>
      useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
    )

    act(() => {
      result.current.onPlaybackError()
    })
    expect(result.current.playerError).toBe('media_playback_failed')

    act(() => {
      result.current.onPlayerRetry()
    })

    expect(result.current.playerError).toBeNull()
    expect(onRetryMock).toHaveBeenCalledTimes(1)
  })
  describe('back href carries the listing filters (S24-S26)', () => {
    const renderVideoDetail = () =>
      renderHook(() =>
        useContenidoDetailViewModel({ id: 'c-1', tipo: 'videos' }),
      )

    it('carries q and vista=tabla', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit&vista=tabla'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe(
        '/contenido/videos?q=medit&vista=tabla',
      )
    })

    it('carries only q', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos?q=medit')
    })

    it('carries only vista=tabla', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('vista=tabla'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos?vista=tabla')
    })

    it('is the plain tab path when the URL has no filters', () => {
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos')
    })

    it('drops an invalid vista but keeps q', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit&vista=foo'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos?q=medit')
    })

    it('is the plain tab path when only vista is invalid', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('vista=foo'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos')
    })

    it('is the plain tab path when q is whitespace only', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams({ q: '   ' }),
      )
      const { result } = renderVideoDetail()
      expect(result.current.backHref).toBe('/contenido/videos')
    })

    it('uses the loaded contenido tab together with the filters (BETA-044)', () => {
      ;(useFetchContenidoById as jest.Mock).mockReturnValue({
        contenido: audioFixture,
        isLoading: false,
        error: null,
      })
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('tipo=videos&q=medit'),
      )
      const { result } = renderHook(() =>
        useContenidoDetailViewModel({ id: 'c-2', tipo: 'videos' }),
      )
      expect(result.current.backHref).toBe('/contenido/mantras?q=medit')
    })

    it('does not carry the filters in the edit href', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit&vista=tabla'),
      )
      const { result } = renderVideoDetail()
      expect(result.current.editHref).toBe('/contenido/c-1/editar?tipo=videos')
    })

    it('round-trips a query with spaces and ampersands through the back href (S25)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams({ q: 'paz & luz' }),
      )
      const { result } = renderVideoDetail()
      expect(
        parseCatalogQuery(
          new URL(result.current.backHref, 'http://x').searchParams.get('q'),
        ),
      ).toBe('paz & luz')
    })

    it('sends the post-delete navigation to the same filtered back href (S26)', () => {
      const push = jest.fn()
      ;(useRouter as jest.Mock).mockReturnValue({ push })
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit&vista=tabla'),
      )
      renderVideoDetail()
      ;(useContenidoMutations as jest.Mock).mock.calls[0][0].refresh()
      expect(push).toHaveBeenCalledWith('/contenido/videos?q=medit&vista=tabla')
    })
  })
})
