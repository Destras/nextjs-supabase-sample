import type { ModalidadRowRaw } from './mapModalidadRow'
import { mapModalidadRow } from './mapModalidadRow'

describe('mapModalidadRow', () => {
  let raw: ModalidadRowRaw

  beforeEach(() => {
    raw = {
      id: 'm-1',
      codigo: 'M01',
      nombre: 'Modalidad 1',
      cantidad_sesiones: 8,
      cantidad_niveles: 4,
      duracion_meses_estimada: 3,
      activo: true,
      tipos_disco: { nombre: 'Disco Azul' },
    }
  })

  it('maps tipoDiscoNombre from tipos_disco.nombre when join is present', () => {
    expect(mapModalidadRow(raw)).toEqual({
      id: 'm-1',
      codigo: 'M01',
      nombre: 'Modalidad 1',
      tipoDiscoNombre: 'Disco Azul',
      cantidadSesiones: 8,
      cantidadNiveles: 4,
      duracionMesesEstimada: 3,
      descripcionCorta: '8 discos · 4 niveles',
      activo: true,
    })
  })

  it('maps tipoDiscoNombre to null when tipos_disco join is null', () => {
    raw.tipos_disco = null
    expect(mapModalidadRow(raw)).toEqual({
      id: 'm-1',
      codigo: 'M01',
      nombre: 'Modalidad 1',
      tipoDiscoNombre: null,
      cantidadSesiones: 8,
      cantidadNiveles: 4,
      duracionMesesEstimada: 3,
      descripcionCorta: '8 discos · 4 niveles',
      activo: true,
    })
  })

  it('propagates null cantidad_sesiones and duracion_meses_estimada as null', () => {
    raw.cantidad_sesiones = null
    raw.duracion_meses_estimada = null
    expect(mapModalidadRow(raw)).toEqual({
      id: 'm-1',
      codigo: 'M01',
      nombre: 'Modalidad 1',
      tipoDiscoNombre: 'Disco Azul',
      cantidadSesiones: null,
      cantidadNiveles: 4,
      duracionMesesEstimada: null,
      descripcionCorta: '— discos · 4 niveles',
      activo: true,
    })
  })

  it('maps a fully populated row correctly', () => {
    expect(mapModalidadRow(raw)).toEqual({
      id: 'm-1',
      codigo: 'M01',
      nombre: 'Modalidad 1',
      tipoDiscoNombre: 'Disco Azul',
      cantidadSesiones: 8,
      cantidadNiveles: 4,
      duracionMesesEstimada: 3,
      descripcionCorta: '8 discos · 4 niveles',
      activo: true,
    })
  })
})
