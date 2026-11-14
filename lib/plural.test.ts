import { plural } from './plural'

describe('plural', () => {
  it('usa el singular con 1', () => {
    expect(plural(1, 'centro', 'centros')).toBe('1 centro')
  })

  it('usa el plural con 0', () => {
    expect(plural(0, 'centro', 'centros')).toBe('0 centros')
  })

  it('usa el plural con más de uno', () => {
    expect(plural(3, 'centro', 'centros')).toBe('3 centros')
  })
})
