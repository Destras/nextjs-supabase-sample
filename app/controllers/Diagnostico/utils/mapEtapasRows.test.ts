import { mapEtapasRows } from './mapEtapasRows'

describe('mapEtapasRows', () => {
  it('returns empty array for empty input', () => {
    expect(mapEtapasRows([])).toEqual([])
  })

  it('maps snake_case row fields to camelCase', () => {
    const rows = [{ numero_etapa: 1, frase_esperada: 'frase uno' }]
    expect(mapEtapasRows(rows)).toEqual([
      { numeroEtapa: 1, fraseEsperada: 'frase uno' },
    ])
  })

  it('sorts ascending by numeroEtapa regardless of input order', () => {
    const rows = [
      { numero_etapa: 3, frase_esperada: 'tres' },
      { numero_etapa: 1, frase_esperada: 'uno' },
      { numero_etapa: 4, frase_esperada: 'cuatro' },
      { numero_etapa: 2, frase_esperada: 'dos' },
    ]
    expect(mapEtapasRows(rows).map((e) => e.numeroEtapa)).toEqual([1, 2, 3, 4])
  })

  it('does not mutate the input array', () => {
    const rows = [
      { numero_etapa: 2, frase_esperada: 'b' },
      { numero_etapa: 1, frase_esperada: 'a' },
    ]
    const before = [...rows]
    mapEtapasRows(rows)
    expect(rows).toEqual(before)
  })
})
