import { formatDate } from './format'

describe('formatDate', () => {
  it('formatea una fecha de día (columna date) como dd/MM/yyyy', () => {
    expect(formatDate('2026-08-31')).toBe('31/08/2026')
  })

  it('conserva el cero adelante en día y mes', () => {
    expect(formatDate('2026-07-06')).toBe('06/07/2026')
  })

  it('devuelve — cuando la fecha es null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('devuelve — cuando la fecha es un string vacío', () => {
    expect(formatDate('')).toBe('—')
  })

  it('muestra un instante (timestamptz) en su día de Argentina', () => {
    expect(formatDate('2026-09-21T17:40:35.740526+00:00')).toBe('21/09/2026')
  })

  it('un instante a las 02:30 UTC cae en el día anterior de Argentina', () => {
    expect(formatDate('2026-06-10T02:30:00Z')).toBe('09/06/2026')
  })

  it('un instante escrito con offset -03:00 conserva su día', () => {
    expect(formatDate('2026-09-21T22:30:00-03:00')).toBe('21/09/2026')
  })

  it('una fecha de día no se corre aunque sea medianoche UTC', () => {
    expect(formatDate('2026-06-10')).toBe('10/06/2026')
  })

  it('devuelve — cuando el string no es una fecha', () => {
    expect(formatDate('constructor')).toBe('—')
  })
})
