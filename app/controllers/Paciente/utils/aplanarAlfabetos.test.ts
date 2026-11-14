import type { AlfabetoConNumeros } from '../PacienteTypes'
import { aplanarAlfabetos } from './aplanarAlfabetos'

describe('aplanarAlfabetos', () => {
  let value: ReadonlyArray<AlfabetoConNumeros>

  beforeEach(() => {
    value = [
      { alfabetoId: 'a', numeros: [1, 2] },
      { alfabetoId: 'b', numeros: [5] },
    ]
  })

  it('emits one row per numero', () => {
    expect(aplanarAlfabetos(value)).toEqual([
      { alfabeto_id: 'a', numero: 1 },
      { alfabeto_id: 'a', numero: 2 },
      { alfabeto_id: 'b', numero: 5 },
    ])
  })

  it('returns an empty list for an empty value', () => {
    expect(aplanarAlfabetos([])).toEqual([])
  })

  it('drops alfabetos without numeros', () => {
    expect(aplanarAlfabetos([{ alfabetoId: 'a', numeros: [] }])).toEqual([])
  })
})
