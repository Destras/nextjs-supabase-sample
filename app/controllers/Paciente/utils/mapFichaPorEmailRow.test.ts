import type { FichaPorEmailRowRaw } from './mapFichaPorEmailRow'
import { mapFichaPorEmailRow } from './mapFichaPorEmailRow'

describe('mapFichaPorEmailRow', () => {
  let raw: FichaPorEmailRowRaw

  beforeEach(() => {
    raw = {
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      estados_paciente: { codigo: 'activo' },
      asignaciones_paciente: [{ fecha_hasta: null }],
    }
  })

  it('maps an active ficha with an open asignación as accesible and not dada de baja', () => {
    expect(mapFichaPorEmailRow(raw)).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: true,
    })
  })

  it('flags a ficha in baja_voluntaria as dada de baja', () => {
    expect(
      mapFichaPorEmailRow({
        ...raw,
        estados_paciente: { codigo: 'baja_voluntaria' },
      }),
    ).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: true,
      accesible: true,
    })
  })

  it('treats a ficha without estado as not dada de baja', () => {
    expect(mapFichaPorEmailRow({ ...raw, estados_paciente: null })).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: true,
    })
  })

  it('flags the ficha as not accesible when every visible asignación is closed', () => {
    expect(
      mapFichaPorEmailRow({
        ...raw,
        asignaciones_paciente: [{ fecha_hasta: '2026-08-20' }],
      }),
    ).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: false,
    })
  })

  it('flags the ficha as accesible when one of several asignaciones is still open', () => {
    expect(
      mapFichaPorEmailRow({
        ...raw,
        asignaciones_paciente: [
          { fecha_hasta: '2026-08-20' },
          { fecha_hasta: null },
        ],
      }),
    ).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: true,
    })
  })

  it('flags the ficha as not accesible when no asignación is visible', () => {
    expect(mapFichaPorEmailRow({ ...raw, asignaciones_paciente: [] })).toEqual({
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: false,
    })
  })
})
