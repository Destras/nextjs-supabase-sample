import { crearCacheDeConsola } from './cacheDeConsola'
import type { CacheDeConsola } from './cacheDeConsola'

describe('crearCacheDeConsola', () => {
  let reloj: number
  let cache: CacheDeConsola

  beforeEach(() => {
    reloj = 1_000
    cache = crearCacheDeConsola({ ttlMs: 60_000, max: 2, ahora: () => reloj })
  })

  it('no conoce una sesión que nunca se recordó', () => {
    expect(cache.esConsolaVigente('sesion-1')).toBe(false)
  })

  it('recuerda una sesión de consola', () => {
    cache.recordar('sesion-1')
    expect(cache.esConsolaVigente('sesion-1')).toBe(true)
  })

  it('sigue vigente justo antes de vencer', () => {
    cache.recordar('sesion-1')
    reloj += 59_999
    expect(cache.esConsolaVigente('sesion-1')).toBe(true)
  })

  it('olvida la sesión cuando vence', () => {
    cache.recordar('sesion-1')
    reloj += 60_000
    expect(cache.esConsolaVigente('sesion-1')).toBe(false)
  })

  it('no mezcla sesiones', () => {
    cache.recordar('sesion-1')
    expect(cache.esConsolaVigente('sesion-2')).toBe(false)
  })

  it('se vacía al superar el máximo, para no crecer sin límite', () => {
    cache.recordar('sesion-1')
    cache.recordar('sesion-2')
    cache.recordar('sesion-3')
    expect(cache.esConsolaVigente('sesion-1')).toBe(false)
  })

  it('conserva la sesión que provocó el vaciado', () => {
    cache.recordar('sesion-1')
    cache.recordar('sesion-2')
    cache.recordar('sesion-3')
    expect(cache.esConsolaVigente('sesion-3')).toBe(true)
  })
})
