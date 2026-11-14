import {
  parseFechaNacimiento,
  formatFechaNacimiento,
  FECHA_NACIMIENTO_MIN_DATE,
  fechaNacimientoMaxDate,
} from './fechaNacimientoCodec'

describe('fechaNacimientoCodec', () => {
  describe('parseFechaNacimiento', () => {
    it('returns undefined for null input', () => {
      expect(parseFechaNacimiento(null)).toBeUndefined()
    })

    it('returns a Date pinned to local noon for an ISO yyyy-MM-dd string', () => {
      const d = parseFechaNacimiento('1990-05-15')
      expect(d).toBeInstanceOf(Date)
      expect(d?.getFullYear()).toBe(1990)
      expect(d?.getMonth()).toBe(4)
      expect(d?.getDate()).toBe(15)
      expect(d?.getHours()).toBe(12)
    })
  })

  describe('formatFechaNacimiento', () => {
    it('returns null for null input', () => {
      expect(formatFechaNacimiento(null)).toBeNull()
    })

    it('returns a yyyy-MM-dd string for a Date', () => {
      const d = new Date(2026, 4, 28, 12, 0)
      expect(formatFechaNacimiento(d)).toBe('2026-05-28')
    })
  })

  describe('boundary dates', () => {
    it('FECHA_NACIMIENTO_MIN_DATE is 1900-01-01 local midnight', () => {
      expect(FECHA_NACIMIENTO_MIN_DATE.getFullYear()).toBe(1900)
      expect(FECHA_NACIMIENTO_MIN_DATE.getMonth()).toBe(0)
    })

    it('fechaNacimientoMaxDate returns todays Date', () => {
      const fixed = new Date(2026, 4, 28)
      expect(fechaNacimientoMaxDate(fixed)).toEqual(fixed)
    })
  })
})
