import { mapAlfabetosRpcError } from './alfabetosMessages'

describe('mapAlfabetosRpcError', () => {
  it('maps numeros_invalidos to the alfabetos copy', () => {
    expect(mapAlfabetosRpcError('numeros_invalidos')).toBe(
      'Revisá los números de los alfabetos.',
    )
  })

  it('returns null for a code that is not about alfabetos', () => {
    expect(mapAlfabetosRpcError('telefono_invalido')).toBeNull()
  })

  it('returns null for a key inherited from Object.prototype', () => {
    expect(mapAlfabetosRpcError('constructor')).toBeNull()
  })
})
