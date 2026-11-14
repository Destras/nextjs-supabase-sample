import { renderHook } from '@testing-library/react'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useFetchAllContenido } from '@/app/controllers/Contenido'
import { usePathname, useSearchParams } from 'next/navigation'
import { useContenidoLayoutViewModel } from './useContenidoLayoutViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

jest.mock('@/app/controllers/Contenido', () => ({
  useFetchAllContenido: jest.fn(),
  TIPO_CONTENIDO: {
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    EGREGOR: 'EGREGOR',
    CMA: 'CMA',
    IC: 'IC',
  },
}))

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Counts go through contenidoToCatalogItem, so the fixtures need the fields
// it reads (id, titulo, contenido.duracion).
const buildContenido = (id: string, tipo: string, titulo: string) => ({
  id,
  tipo,
  titulo,
  descripcion: null,
  contenido: { duracion: null },
})

describe('useContenidoLayoutViewModel', () => {
  beforeEach(() => {
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
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/videos')
  })

  it('returns isAdmin true when profile role is ADMIN', () => {
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.isAdmin).toBe(true)
  })

  it('returns isAdmin false when profile role is TERAPEUTA', () => {
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
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.isAdmin).toBe(false)
  })

  it('returns isResolvingRole true when isLoading is true', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.isResolvingRole).toBe(true)
  })

  it('returns isResolvingRole false when isLoading is false', () => {
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.isResolvingRole).toBe(false)
  })

  it('returns nuevoHref with tipo=videos when pathname ends with /contenido/videos', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/videos')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=videos')
  })

  it('returns nuevoHref with tipo=mantras when pathname ends with /contenido/mantras', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/mantras')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=mantras')
  })

  it('returns nuevoHref with tipo=videos as default when pathname is /contenido', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=videos')
  })

  it('returns nuevoHref with tipo=videos as default when pathname segment is unknown', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/desconocido')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=videos')
  })

  it('falls back to videos when the URL segment is named like an Object.prototype member', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/constructor')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=videos')
  })

  it('returns nuevoHref with tipo=egregores when pathname ends with /contenido/egregores', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/egregores')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=egregores')
  })

  it('returns nuevoHref with tipo=cma when pathname ends with /contenido/cma', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/cma')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=cma')
  })

  it('returns nuevoHref with tipo=ic when pathname ends with /contenido/ic', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/ic')
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.nuevoHref).toBe('/contenido/nuevo?tipo=ic')
  })

  it('does not refetch counts on initial mount (the fetch hooks already load) (CON-007)', () => {
    const refreshContenido = jest.fn()
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: null,
      refresh: refreshContenido,
    })
    renderHook(() => useContenidoLayoutViewModel())
    expect(refreshContenido).not.toHaveBeenCalled()
  })

  it('refetches counts when the pathname changes after a mutation navigates back (CON-007)', () => {
    const refreshContenido = jest.fn()
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [],
      isLoading: false,
      error: null,
      refresh: refreshContenido,
    })
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/nuevo')
    const { rerender } = renderHook(() => useContenidoLayoutViewModel())
    ;(usePathname as jest.Mock).mockReturnValue('/contenido/videos')
    rerender()
    expect(refreshContenido).toHaveBeenCalled()
  })

  it('returns counts derived from contenidos by tipo', () => {
    ;(useFetchAllContenido as jest.Mock).mockReturnValue({
      contenidos: [
        buildContenido('c-1', 'VIDEO', 'Video uno'),
        buildContenido('c-2', 'VIDEO', 'Video dos'),
        buildContenido('c-3', 'AUDIO', 'Mantra uno'),
        buildContenido('c-4', 'EGREGOR', 'Egregor uno'),
        buildContenido('c-5', 'CMA', 'Cma uno'),
        buildContenido('c-6', 'CMA', 'Cma dos'),
        buildContenido('c-7', 'IC', 'Ic uno'),
      ],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useContenidoLayoutViewModel())
    expect(result.current.counts).toEqual({
      videos: 2,
      mantras: 1,
      egregores: 1,
      cma: 2,
      ic: 1,
      total: 7,
    })
  })
  describe('with a query in the URL', () => {
    beforeEach(() => {
      ;(useFetchAllContenido as jest.Mock).mockReturnValue({
        contenidos: [
          buildContenido('c-1', 'VIDEO', 'Meditación guiada'),
          buildContenido('c-2', 'VIDEO', 'Respiración'),
          buildContenido('c-3', 'AUDIO', 'Mantra de meditación'),
          buildContenido('c-4', 'AUDIO', 'Om'),
          buildContenido('c-5', 'CMA', 'Galería'),
        ],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      })
    })

    it('filters the per-tab counts by the q param (S10)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.counts).toEqual({
        videos: 1,
        mantras: 1,
        egregores: 0,
        cma: 0,
        ic: 0,
        total: 5,
      })
    })

    it('returns the totals when q is empty (S11)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('q='))
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.counts).toEqual({
        videos: 2,
        mantras: 2,
        egregores: 0,
        cma: 1,
        ic: 0,
        total: 5,
      })
    })

    it('returns the totals when q is whitespace only (S11)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams({ q: '   ' }),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.counts).toEqual({
        videos: 2,
        mantras: 2,
        egregores: 0,
        cma: 1,
        ic: 0,
        total: 5,
      })
    })

    it('keeps counts.total unfiltered while a query is active (S12)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=zzz'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.counts.total).toBe(5)
    })

    it('exposes the five tabs with plain hrefs and totals when the URL has no filters', () => {
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs).toEqual([
        { tab: 'videos', href: '/contenido/videos', count: 2, isActive: true },
        {
          tab: 'mantras',
          href: '/contenido/mantras',
          count: 2,
          isActive: false,
        },
        {
          tab: 'egregores',
          href: '/contenido/egregores',
          count: 0,
          isActive: false,
        },
        { tab: 'cma', href: '/contenido/cma', count: 1, isActive: false },
        { tab: 'ic', href: '/contenido/ic', count: 0, isActive: false },
      ])
    })

    it('carries q and vista in every tab href and filters the tab counts (S5, S8, S10)', () => {
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('q=medit&vista=tabla'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs).toEqual([
        {
          tab: 'videos',
          href: '/contenido/videos?q=medit&vista=tabla',
          count: 1,
          isActive: true,
        },
        {
          tab: 'mantras',
          href: '/contenido/mantras?q=medit&vista=tabla',
          count: 1,
          isActive: false,
        },
        {
          tab: 'egregores',
          href: '/contenido/egregores?q=medit&vista=tabla',
          count: 0,
          isActive: false,
        },
        {
          tab: 'cma',
          href: '/contenido/cma?q=medit&vista=tabla',
          count: 0,
          isActive: false,
        },
        {
          tab: 'ic',
          href: '/contenido/ic?q=medit&vista=tabla',
          count: 0,
          isActive: false,
        },
      ])
    })

    it('flags the tab from the tipo param on a non-tab route', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/contenido/c-4')
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('tipo=mantras'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs.map((t) => t.isActive)).toEqual([
        false,
        true,
        false,
        false,
        false,
      ])
    })

    it('shows totals and no active tab on /contenido/nuevo without q (REQ-S8)', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/contenido/nuevo')
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs).toEqual([
        { tab: 'videos', href: '/contenido/videos', count: 2, isActive: false },
        {
          tab: 'mantras',
          href: '/contenido/mantras',
          count: 2,
          isActive: false,
        },
        {
          tab: 'egregores',
          href: '/contenido/egregores',
          count: 0,
          isActive: false,
        },
        { tab: 'cma', href: '/contenido/cma', count: 1, isActive: false },
        { tab: 'ic', href: '/contenido/ic', count: 0, isActive: false },
      ])
    })

    it('filters the tab counts on a detail route that carries q (REQ-S8 amended)', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/contenido/c-1')
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('tipo=videos&q=medit&vista=tabla'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs.map((t) => t.count)).toEqual([1, 1, 0, 0, 0])
    })

    it('builds tab hrefs without tipo on a detail route that carries q (REQ-S8 amended)', () => {
      ;(usePathname as jest.Mock).mockReturnValue('/contenido/c-1')
      ;(useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams('tipo=videos&q=medit&vista=tabla'),
      )
      const { result } = renderHook(() => useContenidoLayoutViewModel())
      expect(result.current.tabs[1].href).toBe(
        '/contenido/mantras?q=medit&vista=tabla',
      )
    })
  })
})
