import { mesActual } from './mesActual'

describe('mesActual', () => {
  it('returns null when etapaActiva is null', () => {
    expect(mesActual(null, new Date('2026-06-26T12:00:00Z'))).toEqual(null)
  })

  it('returns 1 when etapa was just started today (floor at 1, never 0)', () => {
    expect(
      mesActual(
        { fechaInicio: '2026-06-26', cantidadNiveles: 4 },
        new Date('2026-06-26T12:00:00Z'),
      ),
    ).toEqual(1)
  })

  it('returns 1 on day 27 (último día de la semana 4)', () => {
    // 2026-05-01 + 27 días = 2026-05-28
    expect(
      mesActual(
        { fechaInicio: '2026-05-01', cantidadNiveles: 4 },
        new Date(2026, 4, 28, 12, 0, 0),
      ),
    ).toEqual(1)
  })

  it('returns 2 on day 28: la semana 5 ya es el mes 2 (ADR 0011), aunque no pasó un mes calendario', () => {
    // 2026-05-01 + 28 días = 2026-05-29 — por calendario seguiría siendo el mes 1
    expect(
      mesActual(
        { fechaInicio: '2026-05-01', cantidadNiveles: 4 },
        new Date(2026, 4, 29, 12, 0, 0),
      ),
    ).toEqual(2)
  })

  it('returns 3 on day 56 (semana 9)', () => {
    // 2026-05-01 + 56 días = 2026-06-26
    expect(
      mesActual(
        { fechaInicio: '2026-05-01', cantidadNiveles: 4 },
        new Date(2026, 5, 26, 12, 0, 0),
      ),
    ).toEqual(3)
  })

  it('returns 4 (capped) when the etapa is long past its 16 weeks and cantidad_niveles=4', () => {
    expect(
      mesActual(
        { fechaInicio: '2025-09-01', cantidadNiveles: 4 },
        new Date(2026, 5, 15, 12, 0, 0),
      ),
    ).toEqual(4)
  })

  it('respects cantidad_niveles != 4: returns 6 (not capped at 4) when cantidad_niveles=6 and the plan is long past', () => {
    expect(
      mesActual(
        { fechaInicio: '2025-09-01', cantidadNiveles: 6 },
        new Date(2026, 5, 15, 12, 0, 0),
      ),
    ).toEqual(6)
  })

  it('returns 1 (floor, never 0) when fechaInicio is in the future', () => {
    expect(
      mesActual(
        { fechaInicio: '2026-07-01', cantidadNiveles: 4 },
        new Date(2026, 5, 1, 12, 0, 0),
      ),
    ).toEqual(1)
  })

  it('counts LOCAL days, not UTC, on the night before a month of treatment starts', () => {
    // 28-may 23:30 LOCAL (UTC-3) = 29-may 02:30 UTC. Iniciada el 01-05: localmente
    // es el día 27 → mesActual = 1 (un cálculo por UTC daría día 28 → mes 2).
    expect(
      mesActual(
        { fechaInicio: '2026-05-01', cantidadNiveles: 4 },
        new Date(2026, 4, 28, 23, 30, 0),
      ),
    ).toEqual(1)
  })
})
