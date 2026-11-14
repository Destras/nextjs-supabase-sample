import { formatDuracion, formatDuracionCelda } from './formatDuracion'

describe('formatDuracion', () => {
  it('formatea segundos a MM:SS con padding', () => {
    expect(formatDuracion(504)).toBe('08:24')
  })
  it('maneja menos de un minuto', () => {
    expect(formatDuracion(9)).toBe('00:09')
  })
  it('devuelve null si la duración es null', () => {
    expect(formatDuracion(null)).toBeNull()
  })
})

describe('formatDuracionCelda', () => {
  it('formats zero seconds', () => {
    expect(formatDuracionCelda(0)).toBe('00:00')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuracionCelda(65)).toBe('01:05')
  })
  it('formats the largest sub-hour value', () => {
    expect(formatDuracionCelda(3599)).toBe('59:59')
  })
  it('renders an em dash when the duration is null', () => {
    expect(formatDuracionCelda(null)).toBe('—')
  })
})
