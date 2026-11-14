import type { SemanaContenido } from './serializeEntregasPlan'
import { serializeEntregasPlan } from './serializeEntregasPlan'

describe('serializeEntregasPlan', () => {
  let semana: SemanaContenido

  beforeEach(() => {
    semana = {
      semana: 1,
      meditacion: 'med-id-1',
      mantra: 'mantra-id-1',
      egregor: 'egregor-id-1',
      cma: 'cma-id-1',
      ic: 'ic-id-1',
    }
  })

  it('returns an empty array when input is empty', () => {
    expect(serializeEntregasPlan([])).toEqual([])
  })

  it('maps a non-null meditacion slot to a contenido_id row with orden 1', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: 'med-id-1',
          mantra: null,
          egregor: null,
          cma: null,
          ic: null,
        },
      ]),
    ).toEqual([{ semana: 1, orden: 1, contenido_id: 'med-id-1' }])
  })

  it('maps a non-null mantra slot to a contenido_id row with orden 2', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: null,
          mantra: 'mantra-id-1',
          egregor: null,
          cma: null,
          ic: null,
        },
      ]),
    ).toEqual([{ semana: 1, orden: 2, contenido_id: 'mantra-id-1' }])
  })

  it('maps a non-null egregor slot to a contenido_id row with orden 3', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: null,
          mantra: null,
          egregor: 'egregor-id-1',
          cma: null,
          ic: null,
        },
      ]),
    ).toEqual([{ semana: 1, orden: 3, contenido_id: 'egregor-id-1' }])
  })

  it('maps a non-null cma slot to a contenido_id row with orden 4', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: null,
          mantra: null,
          egregor: null,
          cma: 'cma-id-1',
          ic: null,
        },
      ]),
    ).toEqual([{ semana: 1, orden: 4, contenido_id: 'cma-id-1' }])
  })

  it('maps a non-null ic slot to a contenido_id row with orden 5', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: null,
          mantra: null,
          egregor: null,
          cma: null,
          ic: 'ic-id-1',
        },
      ]),
    ).toEqual([{ semana: 1, orden: 5, contenido_id: 'ic-id-1' }])
  })

  it('produces no row for an all-null semana', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 1,
          meditacion: null,
          mantra: null,
          egregor: null,
          cma: null,
          ic: null,
        },
      ]),
    ).toEqual([])
  })

  it('produces rows for all 5 slots in a single semana', () => {
    expect(serializeEntregasPlan([semana])).toEqual([
      { semana: 1, orden: 1, contenido_id: 'med-id-1' },
      { semana: 1, orden: 2, contenido_id: 'mantra-id-1' },
      { semana: 1, orden: 3, contenido_id: 'egregor-id-1' },
      { semana: 1, orden: 4, contenido_id: 'cma-id-1' },
      { semana: 1, orden: 5, contenido_id: 'ic-id-1' },
    ])
  })

  it('produces rows for multiple semanas with all slots non-null', () => {
    const semana2: SemanaContenido = {
      semana: 2,
      meditacion: 'med-id-2',
      mantra: 'mantra-id-2',
      egregor: 'egregor-id-2',
      cma: 'cma-id-2',
      ic: 'ic-id-2',
    }
    expect(serializeEntregasPlan([semana, semana2])).toEqual([
      { semana: 1, orden: 1, contenido_id: 'med-id-1' },
      { semana: 1, orden: 2, contenido_id: 'mantra-id-1' },
      { semana: 1, orden: 3, contenido_id: 'egregor-id-1' },
      { semana: 1, orden: 4, contenido_id: 'cma-id-1' },
      { semana: 1, orden: 5, contenido_id: 'ic-id-1' },
      { semana: 2, orden: 1, contenido_id: 'med-id-2' },
      { semana: 2, orden: 2, contenido_id: 'mantra-id-2' },
      { semana: 2, orden: 3, contenido_id: 'egregor-id-2' },
      { semana: 2, orden: 4, contenido_id: 'cma-id-2' },
      { semana: 2, orden: 5, contenido_id: 'ic-id-2' },
    ])
  })

  it('skips null slots in a mixed semana and preserves the rest', () => {
    expect(
      serializeEntregasPlan([
        {
          semana: 3,
          meditacion: 'med-id-3',
          mantra: null,
          egregor: null,
          cma: null,
          ic: null,
        },
      ]),
    ).toEqual([{ semana: 3, orden: 1, contenido_id: 'med-id-3' }])
  })
})
