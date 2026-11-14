import type { AlfabetoRowRaw } from './mapAlfabetoRow'
import { mapAlfabetoRow } from './mapAlfabetoRow'

describe('mapAlfabetoRow', () => {
  let raw: AlfabetoRowRaw

  beforeEach(() => {
    raw = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      codigo: 'A01',
      nombre: 'Alfabeto 1',
      descripcion: 'Una descripción',
      rango_max: 12,
      orden: 3,
      activo: true,
    }
  })

  it('maps a fully populated row correctly', () => {
    expect(mapAlfabetoRow(raw)).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      codigo: 'A01',
      nombre: 'Alfabeto 1',
      descripcion: 'Una descripción',
      rangoMax: 12,
      orden: 3,
      activo: true,
    })
  })

  it('propagates null descripcion as null', () => {
    raw.descripcion = null
    expect(mapAlfabetoRow(raw)).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      codigo: 'A01',
      nombre: 'Alfabeto 1',
      descripcion: null,
      rangoMax: 12,
      orden: 3,
      activo: true,
    })
  })

  it('maps activo false correctly', () => {
    raw.activo = false
    expect(mapAlfabetoRow(raw)).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      codigo: 'A01',
      nombre: 'Alfabeto 1',
      descripcion: 'Una descripción',
      rangoMax: 12,
      orden: 3,
      activo: false,
    })
  })
})
