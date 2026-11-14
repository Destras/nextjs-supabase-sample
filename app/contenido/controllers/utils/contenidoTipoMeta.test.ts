import type { TabKey } from '../catalogItem'
import { contenidoTipoMeta } from './contenidoTipoMeta'

describe('contenidoTipoMeta', () => {
  it('mapea videos', () => {
    expect(contenidoTipoMeta('videos')).toEqual({
      label: 'Meditaciones en video',
      thumbKind: 'video',
      sinReemplazo: 'No hay otra meditación para reemplazarla.',
      tieneDuracion: true,
    })
  })
  it('mapea mantras', () => {
    expect(contenidoTipoMeta('mantras')).toEqual({
      label: 'Mantra',
      thumbKind: 'mantra',
      sinReemplazo: 'No hay otro mantra para reemplazarlo.',
      tieneDuracion: true,
    })
  })
  it('mapea egregores', () => {
    expect(contenidoTipoMeta('egregores')).toEqual({
      label: 'Egregor',
      thumbKind: 'egregor',
      sinReemplazo: 'No hay otro egregor para reemplazarlo.',
      tieneDuracion: true,
    })
  })
  it('mapea cma', () => {
    expect(contenidoTipoMeta('cma')).toEqual({
      label: 'CMA',
      thumbKind: 'galeria',
      sinReemplazo: 'No hay otro CMA para reemplazarlo.',
      tieneDuracion: false,
    })
  })
  it('mapea ic', () => {
    expect(contenidoTipoMeta('ic')).toEqual({
      label: 'IC',
      thumbKind: 'galeria',
      sinReemplazo: 'No hay otra IC para reemplazarla.',
      tieneDuracion: false,
    })
  })
  it('devuelve el genérico para una clave que no es un tipo, aunque exista en Object.prototype', () => {
    expect(contenidoTipoMeta('constructor' as TabKey)).toEqual({
      label: 'Contenido',
      thumbKind: 'galeria',
      sinReemplazo: 'No hay otro contenido para reemplazarlo.',
      tieneDuracion: false,
    })
  })
})
