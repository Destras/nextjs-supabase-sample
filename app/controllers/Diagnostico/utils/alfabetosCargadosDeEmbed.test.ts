import type { EtapaAlfabetoEmbed } from '../DiagnosticoTypes'
import { alfabetosCargadosDeEmbed } from './alfabetosCargadosDeEmbed'

describe('alfabetosCargadosDeEmbed', () => {
  let embed: ReadonlyArray<EtapaAlfabetoEmbed>

  beforeEach(() => {
    embed = [
      { numero: 17, alfabetos: { id: 'a-2', nombre: 'Sigma', orden: 2 } },
      { numero: 21, alfabetos: { id: 'a-1', nombre: 'Iota', orden: 1 } },
      { numero: 4, alfabetos: null },
      { numero: 15, alfabetos: { id: 'a-1', nombre: 'Iota', orden: 1 } },
    ]
  })

  it('returns an empty list for an empty embed', () => {
    expect(alfabetosCargadosDeEmbed([])).toEqual([])
  })

  it('groups the embedded rows by alfabeto in catalog order, skipping rows without alfabeto', () => {
    expect(alfabetosCargadosDeEmbed(embed)).toEqual([
      { alfabetoId: 'a-1', nombre: 'Iota', numeros: [15, 21] },
      { alfabetoId: 'a-2', nombre: 'Sigma', numeros: [17] },
    ])
  })
})
