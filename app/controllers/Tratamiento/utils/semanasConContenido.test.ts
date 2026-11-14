import { semanasConContenido } from './semanasConContenido'
import type { SemanaContenido } from './serializeEntregasPlan'

const vacia = (semana: number): SemanaContenido => ({
  semana,
  meditacion: null,
  mantra: null,
  egregor: null,
  cma: null,
  ic: null,
})

describe('semanasConContenido', () => {
  it('returns 0 for an empty plan', () => {
    expect(semanasConContenido([])).toBe(0)
  })

  it('returns 0 when every slot is null', () => {
    expect(semanasConContenido([vacia(1), vacia(2)])).toBe(0)
  })

  it('counts a week with a single non-null slot', () => {
    expect(semanasConContenido([{ ...vacia(1), ic: 'c-1' }, vacia(2)])).toBe(1)
  })

  it('counts each week once even with several slots filled', () => {
    expect(
      semanasConContenido([
        { ...vacia(1), meditacion: 'a', mantra: 'b' },
        { ...vacia(2), cma: 'c' },
        vacia(3),
      ]),
    ).toBe(2)
  })
})
