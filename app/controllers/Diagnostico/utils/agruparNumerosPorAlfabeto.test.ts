import { agruparNumerosPorAlfabeto } from './agruparNumerosPorAlfabeto'

describe('agruparNumerosPorAlfabeto', () => {
  let filas: ReadonlyArray<{
    readonly alfabetoId: string
    readonly numero: number
    readonly nombre: string
  }>

  beforeEach(() => {
    filas = [
      { alfabetoId: 'b', numero: 5, nombre: 'Sigma' },
      { alfabetoId: 'a', numero: 2, nombre: 'Iota' },
      { alfabetoId: 'b', numero: 3, nombre: 'Sigma' },
      { alfabetoId: 'a', numero: 2, nombre: 'Iota' },
      { alfabetoId: 'a', numero: 1, nombre: 'Iota' },
    ]
  })

  it('returns an empty list when there are no rows', () => {
    expect(agruparNumerosPorAlfabeto([])).toEqual([])
  })

  it('groups by alfabeto in first-appearance order with the first row and its numbers deduplicated ascending', () => {
    expect(agruparNumerosPorAlfabeto(filas)).toEqual([
      {
        primera: { alfabetoId: 'b', numero: 5, nombre: 'Sigma' },
        numeros: [3, 5],
      },
      {
        primera: { alfabetoId: 'a', numero: 2, nombre: 'Iota' },
        numeros: [1, 2],
      },
    ])
  })
})
