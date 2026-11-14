import type { ContenidoRowRaw } from './mapContenidoRow'
import { mapContenidoRow } from './mapContenidoRow'
import { TIPO_CONTENIDO } from '../ContenidoTypes'

describe('mapContenidoRow', () => {
  let raw: ContenidoRowRaw

  beforeEach(() => {
    raw = {
      id: 'c-1',
      tipo: 'video',
      titulo: 'Meditación 1',
      descripcion: 'Una descripción',
      recurso_ref: 'storage://m1.mp4',
      duracion_seg: 600,
    }
  })

  it('returns the mapped Contenido for tipo=video', () => {
    expect(mapContenidoRow(raw)).toEqual({
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Meditación 1',
      descripcion: 'Una descripción',
      contenido: { recursoRef: 'storage://m1.mp4', duracion: 600 },
      imagenes: [],
    })
  })

  it('returns the mapped Contenido for tipo=AUDIO (case-insensitive)', () => {
    raw.tipo = 'AUDIO'
    expect(mapContenidoRow(raw)).toEqual({
      id: 'c-1',
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Meditación 1',
      descripcion: 'Una descripción',
      contenido: { recursoRef: 'storage://m1.mp4', duracion: 600 },
      imagenes: [],
    })
  })

  it('returns null when tipo is unknown', () => {
    raw.tipo = 'desconocido'
    expect(mapContenidoRow(raw)).toBeNull()
  })

  it('returns null for tipo=texto (el ABM manual de frases fue retirado)', () => {
    raw.tipo = 'texto'
    expect(mapContenidoRow(raw)).toBeNull()
  })

  it('returns null when tipo is empty', () => {
    raw.tipo = ''
    expect(mapContenidoRow(raw)).toBeNull()
  })

  it('passes through null descripcion/recurso_ref/duracion_seg', () => {
    raw.descripcion = null
    raw.recurso_ref = null
    raw.duracion_seg = null
    expect(mapContenidoRow(raw)).toEqual({
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Meditación 1',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    })
  })

  // CRITICAL (spec: resolveTipo does not drop new-type rows): unpatched,
  // resolveTipo returns null for these tipos and mapContenidoRow drops the
  // row entirely — the row becomes silently invisible in the console.
  it('returns a non-null Contenido for tipo=egregor', () => {
    raw.tipo = 'egregor'
    expect(mapContenidoRow(raw)).not.toBeNull()
  })

  it('returns tipo EGREGOR (case-insensitive) for tipo=egregor', () => {
    raw.tipo = 'egregor'
    expect(mapContenidoRow(raw)?.tipo).toBe(TIPO_CONTENIDO.EGREGOR)
  })

  it('returns a non-null Contenido for tipo=cma', () => {
    raw.tipo = 'cma'
    expect(mapContenidoRow(raw)).not.toBeNull()
  })

  it('returns tipo CMA (case-insensitive) for tipo=cma', () => {
    raw.tipo = 'CMA'
    expect(mapContenidoRow(raw)?.tipo).toBe(TIPO_CONTENIDO.CMA)
  })

  it('returns a non-null Contenido for tipo=ic', () => {
    raw.tipo = 'ic'
    expect(mapContenidoRow(raw)).not.toBeNull()
  })

  it('returns tipo IC (case-insensitive) for tipo=ic', () => {
    raw.tipo = 'IC'
    expect(mapContenidoRow(raw)?.tipo).toBe(TIPO_CONTENIDO.IC)
  })

  it('defaults imagenes to [] when contenido_imagenes is absent', () => {
    raw.tipo = 'cma'
    expect(mapContenidoRow(raw)?.imagenes).toEqual([])
  })

  it('maps and sorts contenido_imagenes by orden ascending', () => {
    raw.tipo = 'cma'
    raw.recurso_ref = null
    raw.duracion_seg = null
    raw.contenido_imagenes = [
      { path: 'cma/b.jpg', orden: 2 },
      { path: 'cma/a.jpg', orden: 1 },
    ]
    expect(mapContenidoRow(raw)).toEqual({
      id: 'c-1',
      tipo: TIPO_CONTENIDO.CMA,
      titulo: 'Meditación 1',
      descripcion: 'Una descripción',
      contenido: { recursoRef: null, duracion: null },
      imagenes: [
        { path: 'cma/a.jpg', orden: 1 },
        { path: 'cma/b.jpg', orden: 2 },
      ],
    })
  })
})
