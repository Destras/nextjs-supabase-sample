import type { BloqueoRowRaw } from './mapBloqueoRow'
import { mapBloqueoRow } from './mapBloqueoRow'

describe('mapBloqueoRow', () => {
  let raw: BloqueoRowRaw

  beforeEach(() => {
    raw = {
      id: 'b-1',
      codigo: 'B01',
      nombre: 'Bloqueo 1',
      descripcion: 'desc',
      activo: true,
    }
  })

  it('returns the mapped Bloqueo', () => {
    expect(mapBloqueoRow(raw)).toEqual({
      id: 'b-1',
      codigo: 'B01',
      nombre: 'Bloqueo 1',
      descripcion: 'desc',
      activo: true,
    })
  })

  it('coerces null descripcion to empty string', () => {
    raw.descripcion = null
    expect(mapBloqueoRow(raw)).toEqual({
      id: 'b-1',
      codigo: 'B01',
      nombre: 'Bloqueo 1',
      descripcion: '',
      activo: true,
    })
  })
})
