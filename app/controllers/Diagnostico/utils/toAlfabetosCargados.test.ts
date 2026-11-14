import { toAlfabetosCargados } from './toAlfabetosCargados'

describe('toAlfabetosCargados', () => {
  it('returns an empty list when there are no rows', () => {
    expect(toAlfabetosCargados([])).toEqual([])
  })

  it('groups the numbers of one alfabeto', () => {
    expect(
      toAlfabetosCargados([
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 15 },
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 21 },
      ]),
    ).toEqual([{ alfabetoId: 'a-1', nombre: 'Iota', numeros: [15, 21] }])
  })

  it('sorts the numbers ascending', () => {
    expect(
      toAlfabetosCargados([
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 32 },
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 15 },
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 21 },
      ]),
    ).toEqual([{ alfabetoId: 'a-1', nombre: 'Iota', numeros: [15, 21, 32] }])
  })

  it('removes duplicated numbers', () => {
    expect(
      toAlfabetosCargados([
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 15 },
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 15 },
      ]),
    ).toEqual([{ alfabetoId: 'a-1', nombre: 'Iota', numeros: [15] }])
  })

  it('sorts the alfabetos by catalog orden', () => {
    expect(
      toAlfabetosCargados([
        { alfabetoId: 'a-2', nombre: 'Sigma', orden: 2, numero: 17 },
        { alfabetoId: 'a-1', nombre: 'Iota', orden: 1, numero: 15 },
      ]),
    ).toEqual([
      { alfabetoId: 'a-1', nombre: 'Iota', numeros: [15] },
      { alfabetoId: 'a-2', nombre: 'Sigma', numeros: [17] },
    ])
  })
})
