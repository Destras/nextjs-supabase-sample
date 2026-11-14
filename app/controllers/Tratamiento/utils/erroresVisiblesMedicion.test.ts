import { erroresVisiblesMedicion } from './erroresVisiblesMedicion'

describe('erroresVisiblesMedicion', () => {
  let errores: Record<string, string>

  beforeEach(() => {
    errores = {
      general: 'Este campo es obligatorio.',
      'c-1': 'Este campo es obligatorio.',
      'c-2': 'El valor tiene que estar entre 0 y 100.',
    }
  })

  it('no muestra ningún error mientras no se tocó nada', () => {
    expect(erroresVisiblesMedicion(errores, {}, false)).toEqual({})
  })

  it('muestra solo los errores de los campos tocados', () => {
    expect(erroresVisiblesMedicion(errores, { 'c-1': true }, false)).toEqual({
      'c-1': 'Este campo es obligatorio.',
    })
  })

  it('no inventa un error para un campo tocado que es válido', () => {
    expect(erroresVisiblesMedicion(errores, { 'c-9': true }, false)).toEqual({})
  })

  it('muestra todos los errores después de intentar enviar', () => {
    expect(erroresVisiblesMedicion(errores, {}, true)).toEqual(errores)
  })

  it('no trata una clave heredada de Object como campo tocado', () => {
    expect(
      erroresVisiblesMedicion({ constructor: 'Obligatorio' }, {}, false),
    ).toEqual({})
  })
})
