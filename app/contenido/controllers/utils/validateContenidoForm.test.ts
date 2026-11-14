import { validateContenidoForm } from './validateContenidoForm'

describe('validateContenidoForm', () => {
  it('returns error for titulo when titulo is an empty string', () => {
    expect(validateContenidoForm({ titulo: '' })).toEqual({
      titulo: 'El nombre es obligatorio.',
    })
  })

  it('returns error for titulo when titulo is whitespace only', () => {
    expect(validateContenidoForm({ titulo: '   ' })).toEqual({
      titulo: 'El nombre es obligatorio.',
    })
  })

  it('returns empty errors when titulo is valid', () => {
    expect(validateContenidoForm({ titulo: 'Mi video' })).toEqual({})
  })
})
