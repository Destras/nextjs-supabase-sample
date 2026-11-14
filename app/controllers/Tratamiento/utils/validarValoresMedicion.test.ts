import { validarValoresMedicion } from './validarValoresMedicion'
import type { CampoMedicion } from '../TratamientoTypes'

describe('validarValoresMedicion', () => {
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
        key: 'estructura_general',
        label: 'Estructura general',
        centroId: null,
        valorAnterior: null,
      },
    ]
  })

  it('returns no errors when every campo has a valid integer between 0 and 100', () => {
    const valores = { 'centro-1': '70', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({})
  })

  it('flags an empty value as required', () => {
    const valores = { 'centro-1': '', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'Este campo es obligatorio.',
    })
  })

  it('flags a missing key (undefined) as required', () => {
    const valores = { estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'Este campo es obligatorio.',
    })
  })

  it('flags a non-numeric value as invalid', () => {
    const valores = { 'centro-1': 'abc', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'Ingresá un valor numérico.',
    })
  })

  it('flags a decimal value as not an integer', () => {
    const valores = { 'centro-1': '5.5', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'Ingresá un número entero (sin decimales).',
    })
  })

  it('flags a value below 0 as out of range', () => {
    const valores = { 'centro-1': '-1', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'El valor debe estar entre 0 y 100.',
    })
  })

  it('flags a value above 100 as out of range', () => {
    const valores = { 'centro-1': '101', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'El valor debe estar entre 0 y 100.',
    })
  })

  it('accepts the boundary value 0', () => {
    const valores = { 'centro-1': '0', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({})
  })

  it('accepts the boundary value 100', () => {
    const valores = { 'centro-1': '100', estructura_general: '55' }
    expect(validarValoresMedicion(valores, campos)).toEqual({})
  })

  it('collects one error per invalid campo when multiple fail', () => {
    const valores = { 'centro-1': '', estructura_general: '200' }
    expect(validarValoresMedicion(valores, campos)).toEqual({
      'centro-1': 'Este campo es obligatorio.',
      estructura_general: 'El valor debe estar entre 0 y 100.',
    })
  })
})
