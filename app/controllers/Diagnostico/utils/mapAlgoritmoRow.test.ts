import type { AlgoritmoRowRaw } from './mapAlgoritmoRow'
import { mapAlgoritmoRow } from './mapAlgoritmoRow'

describe('mapAlgoritmoRow', () => {
  let raw: AlgoritmoRowRaw

  beforeEach(() => {
    raw = {
      id: 'a-1',
      codigo: 'A01',
      nombre: 'Algo 1',
      definicion: 'def',
      comportamiento: 'beh',
      activo: true,
      algoritmo_etapas: [
        { numero_etapa: 3, frase_esperada: 'tres' },
        { numero_etapa: 1, frase_esperada: 'uno' },
      ],
    }
  })

  it('returns the mapped Algoritmo with etapas sorted and a precomputed comportamientoBadge', () => {
    expect(mapAlgoritmoRow(raw)).toEqual({
      id: 'a-1',
      codigo: 'A01',
      nombre: 'Algo 1',
      definicion: 'def',
      comportamiento: 'beh',
      comportamientoBadge: 'beh',
      activo: true,
      etapas: [
        { numeroEtapa: 1, fraseEsperada: 'uno' },
        { numeroEtapa: 3, fraseEsperada: 'tres' },
      ],
    })
  })

  it('coerces null definicion / comportamiento to empty strings and empty badge', () => {
    raw.definicion = null
    raw.comportamiento = null
    raw.algoritmo_etapas = []
    expect(mapAlgoritmoRow(raw)).toEqual({
      id: 'a-1',
      codigo: 'A01',
      nombre: 'Algo 1',
      definicion: '',
      comportamiento: '',
      comportamientoBadge: '',
      activo: true,
      etapas: [],
    })
  })

  it('truncates comportamientoBadge to 40 chars with ellipsis when longer', () => {
    raw.comportamiento =
      'Perfeccionismo extremo, autocrítica severa, dificultad para descansar'
    const result = mapAlgoritmoRow(raw)
    expect(result.comportamientoBadge).toBe(
      'Perfeccionismo extremo, autocrítica seve…',
    )
    expect(result.comportamientoBadge.length).toBeLessThanOrEqual(41)
  })

  it('does not truncate when comportamiento is exactly 40 chars or less', () => {
    raw.comportamiento = 'corto y al grano'
    expect(mapAlgoritmoRow(raw).comportamientoBadge).toBe('corto y al grano')
  })
})
