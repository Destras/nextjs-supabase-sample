import type { CausaRowRaw } from './mapCausaRow'
import { mapCausaRow } from './mapCausaRow'

describe('mapCausaRow', () => {
  let raw: CausaRowRaw

  beforeEach(() => {
    raw = {
      id: 'c-1',
      codigo: 'C01',
      nombre: 'Causa 1',
      definicion: 'def',
      emociones_esperadas: 'bronca, angustia, miedo',
      activo: true,
      causa_etapas: [
        { numero_etapa: 2, frase_esperada: 'segunda' },
        { numero_etapa: 1, frase_esperada: 'primera' },
      ],
    }
  })

  it('returns the mapped Causa with etapas sorted and emociones split as an array', () => {
    expect(mapCausaRow(raw)).toEqual({
      id: 'c-1',
      codigo: 'C01',
      nombre: 'Causa 1',
      definicion: 'def',
      emocionesEsperadas: ['bronca', 'angustia', 'miedo'],
      activo: true,
      etapas: [
        { numeroEtapa: 1, fraseEsperada: 'primera' },
        { numeroEtapa: 2, fraseEsperada: 'segunda' },
      ],
    })
  })

  it('coerces null definicion to empty string and null emociones_esperadas to empty array', () => {
    raw.definicion = null
    raw.emociones_esperadas = null
    raw.causa_etapas = []
    expect(mapCausaRow(raw)).toEqual({
      id: 'c-1',
      codigo: 'C01',
      nombre: 'Causa 1',
      definicion: '',
      emocionesEsperadas: [],
      activo: true,
      etapas: [],
    })
  })

  it('trims and drops empty entries from emociones_esperadas', () => {
    raw.emociones_esperadas = '  bronca ,, angustia , '
    expect(mapCausaRow(raw).emocionesEsperadas).toEqual(['bronca', 'angustia'])
  })
})
