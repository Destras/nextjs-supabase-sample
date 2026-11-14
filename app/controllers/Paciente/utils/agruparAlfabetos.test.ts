import { agruparAlfabetos } from './agruparAlfabetos'
import { aplanarAlfabetos } from './aplanarAlfabetos'
import type { EtapaAlfabetoRow } from '../PacienteTypes'

describe('agruparAlfabetos', () => {
  let rows: ReadonlyArray<EtapaAlfabetoRow>

  beforeEach(() => {
    rows = [
      { alfabeto_id: 'b', numero: 5 },
      { alfabeto_id: 'a', numero: 2 },
      { alfabeto_id: 'b', numero: 3 },
      { alfabeto_id: 'a', numero: 1 },
    ]
  })

  it('groups by alfabeto keeping first-appearance order and sorting numeros', () => {
    expect(agruparAlfabetos(rows)).toEqual([
      { alfabetoId: 'b', numeros: [3, 5] },
      { alfabetoId: 'a', numeros: [1, 2] },
    ])
  })

  it('deduplicates repeated numeros', () => {
    expect(
      agruparAlfabetos([
        { alfabeto_id: 'a', numero: 2 },
        { alfabeto_id: 'a', numero: 2 },
      ]),
    ).toEqual([{ alfabetoId: 'a', numeros: [2] }])
  })

  it('returns an empty list for no rows', () => {
    expect(agruparAlfabetos([])).toEqual([])
  })

  it('is the inverse of aplanarAlfabetos', () => {
    const value = [
      { alfabetoId: 'a', numeros: [1, 4] },
      { alfabetoId: 'b', numeros: [2] },
    ]
    expect(agruparAlfabetos(aplanarAlfabetos(value))).toEqual(value)
  })
})
