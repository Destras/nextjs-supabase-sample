import {
  formatFechaDia,
  diaDeInstante,
  formatInstante,
  formatInstanteCorto,
  hoyFechaDia,
  parseFechaDia,
} from './fechaDia'

// La suite corre con TZ=America/Argentina/Buenos_Aires (fijada en jest.config.ts):
// los `new Date(y, m, d, h)` de acá son hora de Buenos Aires (UTC-3) en cualquier
// máquina.
describe('fechaDia', () => {
  describe('formatFechaDia', () => {
    it('formatea un día yyyy-MM-dd como dd/MM/yyyy', () => {
      expect(formatFechaDia('2026-08-31')).toBe('31/08/2026')
    })

    it('conserva el cero adelante en día y mes', () => {
      expect(formatFechaDia('2026-07-06')).toBe('06/07/2026')
    })

    it('no corre el día: el 1° de mes no pasa al último del mes anterior', () => {
      expect(formatFechaDia('2026-03-01')).toBe('01/03/2026')
    })

    it('devuelve — cuando la fecha es null', () => {
      expect(formatFechaDia(null)).toBe('—')
    })

    it('devuelve — cuando la fecha es un string vacío', () => {
      expect(formatFechaDia('')).toBe('—')
    })

    it('devuelve — cuando el string no es una fecha de día', () => {
      expect(formatFechaDia('constructor')).toBe('—')
    })
  })

  describe('parseFechaDia', () => {
    it('devuelve el mediodía local de ese día', () => {
      expect(parseFechaDia('1990-05-15')).toEqual(new Date(1990, 4, 15, 12, 0))
    })
  })

  describe('hoyFechaDia', () => {
    it('devuelve el día local en yyyy-MM-dd', () => {
      expect(hoyFechaDia(new Date(2026, 9, 5, 12, 0))).toBe('2026-10-05')
    })

    it('a las 22:00 locales sigue siendo hoy, aunque en UTC ya sea mañana', () => {
      expect(hoyFechaDia(new Date('2026-10-06T01:00:00Z'))).toBe('2026-10-05')
    })

    it('rellena con cero el mes y el día de un dígito', () => {
      expect(hoyFechaDia(new Date(2026, 0, 3, 9, 0))).toBe('2026-01-03')
    })
  })

  describe('diaDeInstante', () => {
    it('devuelve el día de Argentina de un instante, en yyyy-MM-dd', () => {
      expect(diaDeInstante('2026-09-21T17:40:35.740526+00:00')).toBe(
        '2026-09-21',
      )
    })

    it('a las 02:30 UTC todavía es el día anterior en Argentina', () => {
      expect(diaDeInstante('2026-06-10T02:30:00Z')).toBe('2026-06-09')
    })

    it('a las 03:00 UTC ya es el día nuevo en Argentina', () => {
      expect(diaDeInstante('2026-06-10T03:00:00Z')).toBe('2026-06-10')
    })

    it('devuelve null cuando el instante es null', () => {
      expect(diaDeInstante(null)).toBeNull()
    })

    it('devuelve null cuando el string no es un instante', () => {
      expect(diaDeInstante('constructor')).toBeNull()
    })
  })

  describe('formatInstante', () => {
    it('formatea el día de Argentina de un instante como dd/MM/yyyy', () => {
      expect(formatInstante('2026-06-10T02:30:00Z')).toBe('09/06/2026')
    })

    it('respeta el offset con el que viene escrito el instante', () => {
      expect(formatInstante('2026-09-21T22:30:00-03:00')).toBe('21/09/2026')
    })

    it('cruza el año cuando el instante cae el 1 de enero en UTC', () => {
      expect(formatInstante('2027-01-01T01:00:00Z')).toBe('31/12/2026')
    })

    it('devuelve — cuando el instante es null', () => {
      expect(formatInstante(null)).toBe('—')
    })

    it('devuelve — cuando el string no es un instante', () => {
      expect(formatInstante('constructor')).toBe('—')
    })
  })

  describe('formatInstanteCorto', () => {
    it('formatea el día de Argentina con el año en dos dígitos', () => {
      expect(formatInstanteCorto('2026-06-10T02:30:00Z')).toBe('09/06/26')
    })

    it('devuelve — cuando el string no es un instante', () => {
      expect(formatInstanteCorto('constructor')).toBe('—')
    })
  })
})
