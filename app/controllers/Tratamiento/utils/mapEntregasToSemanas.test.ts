import { mapEntregasToSemanas } from './mapEntregasToSemanas'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import type { EntregaSemanal } from '../TratamientoTypes'

// Minimal fixture helper — casts to satisfy the discriminated union;
// only id + tipo are needed by the mapper logic under test.
const makeEntrega = (
  numeroSemana: number,
  contenido: { id: string; tipo: string }[],
): EntregaSemanal =>
  ({
    id: `semana-${numeroSemana}`,
    numeroSemana,
    fechaEntregada: null,
    fechaEntregaEsperada: null,
    contenido: contenido.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      titulo: null,
      descripcion: null,
    })),
  }) as unknown as EntregaSemanal

describe('mapEntregasToSemanas', () => {
  it('returns an empty array when semanasTotales is 0', () => {
    expect(mapEntregasToSemanas([], 0)).toEqual([])
  })

  it('returns N all-null rows when entregasSemanales is empty', () => {
    const result = mapEntregasToSemanas([], 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      semana: 1,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
    expect(result[1]).toEqual({
      semana: 2,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
    expect(result[2]).toEqual({
      semana: 3,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
  })

  it('maps a VIDEO contenido to the meditacion slot', () => {
    const entregas = [
      makeEntrega(1, [{ id: 'v-1', tipo: TIPO_CONTENIDO.VIDEO }]),
    ]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]?.meditacion).toBe('v-1')
    expect(result[0]?.mantra).toBeNull()
  })

  it('maps an AUDIO contenido to the mantra slot', () => {
    const entregas = [
      makeEntrega(1, [{ id: 'a-1', tipo: TIPO_CONTENIDO.AUDIO }]),
    ]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]?.mantra).toBe('a-1')
    expect(result[0]?.meditacion).toBeNull()
  })

  it('maps an EGREGOR contenido to the egregor slot', () => {
    const entregas = [
      makeEntrega(1, [{ id: 'e-1', tipo: TIPO_CONTENIDO.EGREGOR }]),
    ]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]?.egregor).toBe('e-1')
  })

  it('maps a CMA contenido to the cma slot', () => {
    const entregas = [makeEntrega(1, [{ id: 'c-1', tipo: TIPO_CONTENIDO.CMA }])]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]?.cma).toBe('c-1')
  })

  it('maps an IC contenido to the ic slot', () => {
    const entregas = [makeEntrega(1, [{ id: 'i-1', tipo: TIPO_CONTENIDO.IC }])]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]?.ic).toBe('i-1')
  })

  it('maps all five slots in one semana', () => {
    const entregas = [
      makeEntrega(1, [
        { id: 'v-1', tipo: TIPO_CONTENIDO.VIDEO },
        { id: 'a-1', tipo: TIPO_CONTENIDO.AUDIO },
        { id: 'e-1', tipo: TIPO_CONTENIDO.EGREGOR },
        { id: 'c-1', tipo: TIPO_CONTENIDO.CMA },
        { id: 'i-1', tipo: TIPO_CONTENIDO.IC },
      ]),
    ]
    const result = mapEntregasToSemanas(entregas, 1)
    expect(result[0]).toEqual({
      semana: 1,
      meditacion: 'v-1',
      mantra: 'a-1',
      egregor: 'e-1',
      cma: 'c-1',
      ic: 'i-1',
    })
  })

  it('leaves null slots for semanas missing from entregasSemanales', () => {
    const entregas = [
      makeEntrega(2, [{ id: 'v-2', tipo: TIPO_CONTENIDO.VIDEO }]),
    ]
    const result = mapEntregasToSemanas(entregas, 3)
    expect(result[0]).toEqual({
      semana: 1,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
    expect(result[1]?.meditacion).toBe('v-2')
    expect(result[2]).toEqual({
      semana: 3,
      meditacion: null,
      mantra: null,
      egregor: null,
      cma: null,
      ic: null,
    })
  })

  it('maps multiple semanas in sequence', () => {
    const entregas = [
      makeEntrega(1, [
        { id: 'v-1', tipo: TIPO_CONTENIDO.VIDEO },
        { id: 'a-1', tipo: TIPO_CONTENIDO.AUDIO },
      ]),
      makeEntrega(2, [
        { id: 'v-2', tipo: TIPO_CONTENIDO.VIDEO },
        { id: 'a-2', tipo: TIPO_CONTENIDO.AUDIO },
      ]),
    ]
    const result = mapEntregasToSemanas(entregas, 2)
    expect(result[0]).toEqual({
      semana: 1,
      meditacion: 'v-1',
      mantra: 'a-1',
      egregor: null,
      cma: null,
      ic: null,
    })
    expect(result[1]).toEqual({
      semana: 2,
      meditacion: 'v-2',
      mantra: 'a-2',
      egregor: null,
      cma: null,
      ic: null,
    })
  })
})
