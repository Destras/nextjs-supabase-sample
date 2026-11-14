import { renderHook, act } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import {
  useFetchAllContenido,
  TIPO_CONTENIDO,
} from '@/app/controllers/Contenido'
import type { Contenido } from '@/app/controllers/Contenido'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useContenidoTipoTabViewModel } from './useContenidoTipoTabViewModel'

jest.mock('@/app/controllers/Contenido', () => ({
  ...jest.requireActual('@/app/controllers/Contenido'),
  useFetchAllContenido: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}))

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

const buildVideo = (id: string, titulo: string): Contenido => ({
  id,
  tipo: TIPO_CONTENIDO.VIDEO,
  titulo,
  descripcion: null,
  contenido: { recursoRef: null, duracion: null },
  imagenes: [],
})

describe('useContenidoTipoTabViewModel', () => {
  let videoFixture: Contenido
  let audioFixture: Contenido
  let replaceStateSpy: jest.SpyInstance

  const setContenidos = (contenidos: ReadonlyArray<Contenido>) => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
  }

  const setUrlParams = (search: string) => {
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(search))
  }

  beforeEach(() => {
    jest.useFakeTimers()
    // pushState (not spied) positions window.location without polluting the
    // replaceState call history the URL writes are asserted on.
    window.history.pushState(null, '', '/contenido/videos')
    window.localStorage.clear()
    replaceStateSpy = jest.spyOn(window.history, 'replaceState')
    setUrlParams('')
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
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [videoFixture, audioFixture],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    replaceStateSpy.mockRestore()
    jest.useRealTimers()
  })

  it('returns only VIDEO items when tipo is VIDEO', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.items).toEqual([
      {
        id: 'c-1',
        source: 'contenido',
        tab: 'videos',
        nombre: 'Mi Video',
        descripcion: 'desc video',
        isPlayable: false,
        duracionSeg: null,
        href: '/contenido/c-1?tipo=videos',
      },
    ])
  })

  it('returns only AUDIO items when tipo is AUDIO', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.AUDIO),
    )
    expect(result.current.items).toEqual([
      {
        id: 'c-2',
        source: 'contenido',
        tab: 'mantras',
        nombre: 'Mi Mantra',
        descripcion: null,
        isPlayable: false,
        duracionSeg: null,
        href: '/contenido/c-2?tipo=mantras',
      },
    ])
  })

  it('returns isAdmin true when profile role is ADMIN', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.isAdmin).toBe(true)
  })

  it('returns isAdmin false when profile role is not ADMIN', () => {
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
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.isAdmin).toBe(false)
  })

  it('returns isLoading true when profile is loading', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.isLoading).toBe(true)
  })

  it('returns isLoading true when fetch is loading', () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.isLoading).toBe(true)
  })

  it('returns profileError as error when both profileError and fetchError exist', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: 'profile error',
    })
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: 'fetch error',
      refresh: jest.fn(),
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.error).toBe('profile error')
  })

  it('returns fetchError as error when there is no profileError', () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: 'fetch error',
      refresh: jest.fn(),
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.error).toBe('fetch error')
  })
  it('filters the items by the q param (S13)', () => {
    setContenidos([
      buildVideo('c-3', 'Meditación guiada'),
      buildVideo('c-4', 'Respiración'),
      audioFixture,
    ])
    setUrlParams('q=medit')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.items).toEqual([
      {
        id: 'c-3',
        source: 'contenido',
        tab: 'videos',
        nombre: 'Meditación guiada',
        descripcion: null,
        isPlayable: false,
        duracionSeg: null,
        href: '/contenido/c-3?tipo=videos&q=medit',
      },
    ])
  })

  it('sorts the items alphabetically by name, accent-insensitive', () => {
    setContenidos([
      buildVideo('c-3', 'Zen'),
      buildVideo('c-4', 'Émbolo'),
      buildVideo('c-5', 'Ánima'),
      buildVideo('c-6', 'Eco'),
    ])
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.items.map((item) => item.nombre)).toEqual([
      'Ánima',
      'Eco',
      'Émbolo',
      'Zen',
    ])
  })

  it('filters first and then sorts the matches (L6)', () => {
    setContenidos([
      buildVideo('c-3', 'Zen meditación'),
      buildVideo('c-4', 'Respiración'),
      buildVideo('c-5', 'Ánima meditación'),
    ])
    setUrlParams('q=medit')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.items.map((item) => item.nombre)).toEqual([
      'Ánima meditación',
      'Zen meditación',
    ])
  })

  it('reports viewMode tabla when vista=tabla (V2)', () => {
    setUrlParams('vista=tabla')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.viewMode).toBe('tabla')
  })

  it('reports viewMode cards when vista is absent (V2)', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.viewMode).toBe('cards')
  })

  it('reports viewMode cards when vista is not a valid mode (V2)', () => {
    setUrlParams('vista=foo')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.viewMode).toBe('cards')
  })

  it('starts searchInput from the q param', () => {
    setUrlParams('q=medit')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.searchInput).toBe('medit')
  })

  it('starts searchInput empty when there is no q param', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.searchInput).toBe('')
  })

  it('reports status ready when the tab has items and no query', () => {
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('ready')
  })

  it('reports status search-empty when a query matches nothing in a non-empty tab (S18)', () => {
    setUrlParams('q=zzz')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('search-empty')
  })

  it('reports status catalog-empty when the tab has no items (L8)', () => {
    setContenidos([audioFixture])
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('catalog-empty')
  })

  it('reports status catalog-empty, not search-empty, when the tab has no items and a query is active (S18)', () => {
    setContenidos([audioFixture])
    setUrlParams('q=medit')
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('catalog-empty')
  })

  it('reports status loading while the fetch is loading (L9)', () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: true,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('loading')
  })

  it('reports status error when the fetch fails (L9)', () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: 'fetch error',
      refresh: jest.fn(),
    })
    const { result } = renderHook(() =>
      useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
    )
    expect(result.current.status).toBe('error')
  })

  describe('item detail hrefs (S21-S23)', () => {
    it('is the plain detail href when the URL has no filters', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      expect(result.current.items[0].href).toBe('/contenido/c-1?tipo=videos')
    })

    it('carries q and vista when both are in the URL', () => {
      setContenidos([buildVideo('c-1', 'Meditación guiada')])
      setUrlParams('q=medit&vista=tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      expect(result.current.items[0].href).toBe(
        '/contenido/c-1?tipo=videos&q=medit&vista=tabla',
      )
    })

    it('carries only q when vista is absent', () => {
      setContenidos([buildVideo('c-1', 'Meditación guiada')])
      setUrlParams('q=medit')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      expect(result.current.items[0].href).toBe(
        '/contenido/c-1?tipo=videos&q=medit',
      )
    })

    it('carries only vista when q is absent', () => {
      setUrlParams('vista=tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      expect(result.current.items[0].href).toBe(
        '/contenido/c-1?tipo=videos&vista=tabla',
      )
    })

    it('carries the applied URL query, not the text typed but not yet applied (S23)', () => {
      setContenidos([buildVideo('c-1', 'Meditación guiada')])
      setUrlParams('q=medit')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('medita')
      })
      expect(result.current.items[0].href).toBe(
        '/contenido/c-1?tipo=videos&q=medit',
      )
    })
  })
  describe('writing the query to the URL (S14)', () => {
    it('updates searchInput immediately while typing', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      expect(result.current.searchInput).toBe('abc')
    })

    it('does not write the URL before the debounce window ends', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(199)
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('writes q to the URL once the debounce window ends', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=abc',
      )
    })

    it('collapses consecutive keystrokes into one write', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('a')
        jest.advanceTimersByTime(100)
        result.current.onSearchInputChange('ab')
        jest.advanceTimersByTime(100)
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    })

    it('writes the last typed value when keystrokes are collapsed', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('a')
        jest.advanceTimersByTime(100)
        result.current.onSearchInputChange('ab')
        jest.advanceTimersByTime(100)
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=abc',
      )
    })

    it('preserves the other params of the current location', () => {
      window.history.pushState(null, '', '/contenido/videos?vista=tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?vista=tabla&q=abc',
      )
    })

    it('removes q from the URL when the input is cleared, keeping other params', () => {
      window.history.pushState(null, '', '/contenido/videos?q=abc&vista=tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?vista=tabla',
      )
    })

    it('writes the bare path when clearing the input leaves no params', () => {
      window.history.pushState(null, '', '/contenido/videos?q=abc')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos',
      )
    })
  })

  describe('writing the view mode to the URL (V3, V4)', () => {
    it('writes vista=tabla keeping q, without waiting for the debounce', () => {
      window.history.pushState(null, '', '/contenido/videos?q=medit')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('tabla')
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=medit&vista=tabla',
      )
    })

    it('removes vista when switching back to cards, keeping q', () => {
      window.history.pushState(
        null,
        '',
        '/contenido/videos?q=medit&vista=tabla',
      )
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('cards')
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=medit',
      )
    })

    it('ignores the empty value the toggle emits when the active option is clicked', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('')
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('ignores a value that is not a view mode', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('x')
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('keeps both q and vista when a view mode change lands inside the debounce window', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        result.current.onViewModeChange('tabla')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?vista=tabla&q=abc',
      )
    })
  })
  describe('remembering the view mode', () => {
    it('adds vista=tabla to the URL on mount when none is set and tabla is stored', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy.mock.calls).toEqual([
        [null, '', '/contenido/videos?vista=tabla'],
      ])
    })

    it('keeps q when it adds vista=tabla on mount', () => {
      window.history.pushState(null, '', '/contenido/videos?q=medit')
      setUrlParams('q=medit')
      window.localStorage.setItem('contenido.vista', 'tabla')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy.mock.calls).toEqual([
        [null, '', '/contenido/videos?q=medit&vista=tabla'],
      ])
    })

    it('does not write the URL on mount when cards is stored', () => {
      window.localStorage.setItem('contenido.vista', 'cards')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not write the URL on mount when nothing is stored', () => {
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not write the URL on mount when the stored value is invalid', () => {
      window.localStorage.setItem('contenido.vista', 'foo')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not write the URL on mount when the URL already carries vista', () => {
      setUrlParams('vista=tabla')
      window.localStorage.setItem('contenido.vista', 'cards')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('keeps the stored preference when the URL carries a different vista', () => {
      setUrlParams('vista=tabla')
      window.localStorage.setItem('contenido.vista', 'cards')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(window.localStorage.getItem('contenido.vista')).toBe('cards')
    })

    it('treats an invalid vista in the URL as present and leaves it alone', () => {
      setUrlParams('vista=foo')
      window.localStorage.setItem('contenido.vista', 'tabla')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not touch the storage on mount', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem')
      setUrlParams('vista=tabla')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('stores tabla when the user picks the table', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('tabla')
      })
      expect(window.localStorage.getItem('contenido.vista')).toBe('tabla')
    })

    it('stores cards when the user picks the cards', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('cards')
      })
      expect(window.localStorage.getItem('contenido.vista')).toBe('cards')
    })

    it('leaves the storage untouched when the toggle emits the empty value', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      setUrlParams('vista=tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('')
      })
      expect(window.localStorage.getItem('contenido.vista')).toBe('tabla')
    })

    it('mounts without throwing and without writing the URL when reading the storage throws', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO))
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('still switches the view when writing the storage throws', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onViewModeChange('tabla')
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?vista=tabla',
      )
    })

    it('still debounces the search write with both q and vista after the mount-time write', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?vista=tabla&q=abc',
      )
    })

    it('applies the stored preference only once when the hook rerenders with an unchanged URL', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      const { rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      rerender()
      expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    })

    it('does not reapply the stored preference when vista disappears from the URL after mount', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      setUrlParams('vista=tabla')
      const { rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      setUrlParams('')
      rerender()
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not mistake the mount-time vista write for an external q change', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      const { result, rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      setUrlParams('vista=tabla')
      rerender()
      expect(result.current.searchInput).toBe('abc')
    })

    it('writes the same URL on every run under React Strict Mode', () => {
      window.localStorage.setItem('contenido.vista', 'tabla')
      renderHook(() => useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO), {
        reactStrictMode: true,
      })
      expect(
        new Set(replaceStateSpy.mock.calls.map((call) => call[2])),
      ).toEqual(new Set(['/contenido/videos?vista=tabla']))
    })
  })

  describe('syncing the input with the URL', () => {
    it('resyncs searchInput when the URL q changes from outside', () => {
      const { result, rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      setUrlParams('q=externo')
      rerender()
      expect(result.current.searchInput).toBe('externo')
    })

    it('keeps the characters typed during the debounce window when the URL catches up with the last write', () => {
      const { result, rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
        jest.advanceTimersByTime(200)
      })
      act(() => {
        result.current.onSearchInputChange('abcd')
      })
      setUrlParams('q=abc')
      rerender()
      expect(result.current.searchInput).toBe('abcd')
    })
  })

  describe('external URL change with a pending write', () => {
    it('drops the pending write so the stale typed value does not overwrite the URL', () => {
      const { result, rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      setUrlParams('q=externo')
      rerender()
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not flush the dropped write on blur either', () => {
      const { result, rerender } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      setUrlParams('q=externo')
      rerender()
      act(() => {
        result.current.onSearchBlur()
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })
  })

  describe('flushing a pending write (R4)', () => {
    it('writes the pending query immediately on blur', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      act(() => {
        result.current.onSearchBlur()
      })
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=abc',
      )
    })

    it('does not write a second time when the debounce window ends after a blur flush', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      act(() => {
        result.current.onSearchBlur()
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    })

    it('does nothing on blur when no write is pending', () => {
      const { result } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchBlur()
      })
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('writes the pending query on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      unmount()
      expect(replaceStateSpy).toHaveBeenLastCalledWith(
        null,
        '',
        '/contenido/videos?q=abc',
      )
    })

    it('writes only once when the debounce window ends after an unmount flush', () => {
      const { result, unmount } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      unmount()
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    })

    it('skips the unmount flush when the pathname changed since the write was scheduled', () => {
      const { result, unmount } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      act(() => {
        result.current.onSearchInputChange('abc')
      })
      window.history.pushState(null, '', '/contenido/mantras')
      unmount()
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })

    it('does not write on unmount when nothing is pending', () => {
      const { unmount } = renderHook(() =>
        useContenidoTipoTabViewModel(TIPO_CONTENIDO.VIDEO),
      )
      unmount()
      expect(replaceStateSpy).not.toHaveBeenCalled()
    })
  })
})
