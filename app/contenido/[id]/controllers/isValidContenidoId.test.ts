import { isValidContenidoId } from './isValidContenidoId'

describe('isValidContenidoId', () => {
  it('returns true for a well-formed uuid', () => {
    expect(isValidContenidoId('d0000001-0000-0000-0000-000000000000')).toBe(
      true,
    )
  })

  it('returns false for a non-uuid string', () => {
    expect(isValidContenidoId('frases')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isValidContenidoId('')).toBe(false)
  })

  it('returns false for a uuid-shaped string with a short segment', () => {
    expect(isValidContenidoId('d000001-0000-0000-0000-000000000000')).toBe(
      false,
    )
  })

  it('returns false for a uuid-shaped string with an invalid character', () => {
    expect(isValidContenidoId('d0000001-0000-0000-0000-00000000000g')).toBe(
      false,
    )
  })
})
