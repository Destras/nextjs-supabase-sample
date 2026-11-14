import { computePasos } from './pasos'

describe('computePasos', () => {
  it('marks paso 1 as active and 2/3 as upcoming when pasoActual = 1', () => {
    const result = computePasos(1)
    expect(result.map((p) => p.status)).toEqual([
      'active',
      'upcoming',
      'upcoming',
    ])
  })

  it('marks paso 1 as done, 2 as active, 3 as upcoming when pasoActual = 2', () => {
    const result = computePasos(2)
    expect(result.map((p) => p.status)).toEqual(['done', 'active', 'upcoming'])
  })

  it('marks pasos 1 and 2 as done and 3 as active when pasoActual = 3', () => {
    const result = computePasos(3)
    expect(result.map((p) => p.status)).toEqual(['done', 'done', 'active'])
  })

  it('returns the same 3 step definitions regardless of pasoActual', () => {
    expect(computePasos(1).map((p) => p.label)).toEqual([
      'PASO 01',
      'PASO 02',
      'PASO 03',
    ])
    expect(computePasos(2).map((p) => p.title)).toEqual([
      'Identidad',
      'Diagnóstico',
      'Plan',
    ])
  })
})
