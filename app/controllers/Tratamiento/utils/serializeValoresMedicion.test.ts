import { serializeValoresMedicion } from './serializeValoresMedicion'
import type { CampoMedicion } from '../TratamientoTypes'

describe('serializeValoresMedicion', () => {
  let campos: ReadonlyArray<CampoMedicion>

  beforeEach(() => {
    campos = [
      {
        key: 'centro-1',
        label: 'Corona',
        centroId: 'centro-1',
        valorAnterior: null,
      },
      {
        key: 'centro-2',
        label: 'Garganta',
        centroId: 'centro-2',
        valorAnterior: 40,
      },
      {
        key: 'estructura_general',
        label: 'Estructura general',
        centroId: null,
        valorAnterior: null,
      },
    ]
  })

  it('serializes campos into the p_valores wire shape', () => {
    const valores = {
      'centro-1': '70',
      'centro-2': '42',
      estructura_general: '55',
    }
    expect(serializeValoresMedicion(valores, campos)).toEqual({
      estructura_general: 55,
      centros: [
        { centro_id: 'centro-1', valor: 70 },
        { centro_id: 'centro-2', valor: 42 },
      ],
    })
  })

  it('keeps the estructura general field out of the centros array', () => {
    const valores = {
      'centro-1': '10',
      'centro-2': '20',
      estructura_general: '30',
    }
    const result = serializeValoresMedicion(valores, campos)
    expect(
      result.centros.some((c) => c.centro_id === 'estructura_general'),
    ).toBe(false)
  })

  it('coerces string values to numbers', () => {
    const valores = {
      'centro-1': '70',
      'centro-2': '42',
      estructura_general: '55',
    }
    const result = serializeValoresMedicion(valores, campos)
    expect(typeof result.estructura_general).toBe('number')
  })
})
