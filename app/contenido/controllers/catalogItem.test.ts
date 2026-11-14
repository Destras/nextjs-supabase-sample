import type { Contenido } from '@/app/controllers/Contenido'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import { contenidoToCatalogItem } from './catalogItem'

describe('contenidoToCatalogItem', () => {
  let videoContenido: Contenido
  let audioContenido: Contenido

  beforeEach(() => {
    videoContenido = {
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Mi Video',
      descripcion: 'desc',
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
    audioContenido = {
      id: 'c-2',
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Mi Mantra',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
  })

  it('maps a VIDEO contenido to a CatalogItem with tab=videos and source=contenido', () => {
    expect(contenidoToCatalogItem(videoContenido)).toEqual({
      id: 'c-1',
      source: 'contenido',
      tab: 'videos',
      nombre: 'Mi Video',
      descripcion: 'desc',
      isPlayable: false,
      duracionSeg: null,
    })
  })

  it('maps an AUDIO contenido to a CatalogItem with tab=mantras and source=contenido', () => {
    expect(contenidoToCatalogItem(audioContenido)).toEqual({
      id: 'c-2',
      source: 'contenido',
      tab: 'mantras',
      nombre: 'Mi Mantra',
      descripcion: null,
      isPlayable: false,
      duracionSeg: null,
    })
  })

  it('falls back to empty string for nombre when titulo is null (VIDEO)', () => {
    expect(contenidoToCatalogItem({ ...videoContenido, titulo: null })).toEqual(
      {
        id: 'c-1',
        source: 'contenido',
        tab: 'videos',
        nombre: '',
        descripcion: 'desc',
        isPlayable: false,
        duracionSeg: null,
      },
    )
  })

  it('falls back to empty string for nombre when titulo is null (AUDIO)', () => {
    expect(contenidoToCatalogItem({ ...audioContenido, titulo: null })).toEqual(
      {
        id: 'c-2',
        source: 'contenido',
        tab: 'mantras',
        nombre: '',
        descripcion: null,
        isPlayable: false,
        duracionSeg: null,
      },
    )
  })

  it('maps an EGREGOR contenido to tab=egregores (its own catalog route)', () => {
    const item = contenidoToCatalogItem({
      ...videoContenido,
      tipo: TIPO_CONTENIDO.EGREGOR,
    })
    expect(item.tab).toBe('egregores')
  })

  it('maps a CMA contenido to tab=cma (its own catalog route)', () => {
    const item = contenidoToCatalogItem({
      ...videoContenido,
      tipo: TIPO_CONTENIDO.CMA,
    })
    expect(item.tab).toBe('cma')
  })

  it('maps an IC contenido to tab=ic (its own catalog route)', () => {
    const item = contenidoToCatalogItem({
      ...videoContenido,
      tipo: TIPO_CONTENIDO.IC,
    })
    expect(item.tab).toBe('ic')
  })

  it('mapea duracionSeg desde MediaContent para video/mantra', () => {
    const item = contenidoToCatalogItem({
      id: 'v1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'T',
      descripcion: null,
      contenido: { recursoRef: null, duracion: 504 },
      imagenes: [],
    })
    expect(item.duracionSeg).toBe(504)
  })
})
