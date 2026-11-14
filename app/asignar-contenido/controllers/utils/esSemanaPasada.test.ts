import { esSemanaPasada } from './esSemanaPasada'

describe('esSemanaPasada', () => {
  it('is false when the treatment has not started (null week)', () => {
    expect(esSemanaPasada(1, null)).toBe(false)
  })

  it('is true for a week before the current one', () => {
    expect(esSemanaPasada(2, 3)).toBe(true)
  })

  it('is false for the current week', () => {
    expect(esSemanaPasada(3, 3)).toBe(false)
  })

  it('is false for a future week', () => {
    expect(esSemanaPasada(4, 3)).toBe(false)
  })
})
