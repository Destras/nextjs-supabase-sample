import { waveBarHeights } from './waveBarHeights'

describe('waveBarHeights', () => {
  it('devuelve la cantidad pedida', () => {
    expect(waveBarHeights(32, 3)).toHaveLength(32)
  })
  it('es determinista para el mismo seed', () => {
    expect(waveBarHeights(8, 1)).toEqual(waveBarHeights(8, 1))
  })
  it('todas las alturas quedan en [0.18, 1]', () => {
    for (const h of waveBarHeights(64, 5)) {
      expect(h).toBeGreaterThanOrEqual(0.18)
      expect(h).toBeLessThanOrEqual(1)
    }
  })
})
