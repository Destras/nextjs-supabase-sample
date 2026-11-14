import { ROLE } from '../AuthTypes'
import { resolveRole } from './resolveRole'

describe('resolveRole', () => {
  let codigo: string | undefined

  beforeEach(() => {
    codigo = undefined
  })

  it('returns ROLE.ADMIN when codigo is "admin"', () => {
    expect(resolveRole('admin')).toEqual(ROLE.ADMIN)
  })

  it('returns ROLE.TERAPEUTA when codigo is "terapeuta"', () => {
    expect(resolveRole('terapeuta')).toEqual(ROLE.TERAPEUTA)
  })

  it('returns ROLE.PACIENTE when codigo is "paciente"', () => {
    expect(resolveRole('paciente')).toEqual(ROLE.PACIENTE)
  })

  it('returns ROLE.PACIENTE when codigo is an unknown string', () => {
    expect(resolveRole('whatever')).toEqual(ROLE.PACIENTE)
  })

  it('returns ROLE.PACIENTE when codigo is undefined', () => {
    expect(resolveRole(codigo)).toEqual(ROLE.PACIENTE)
  })
})
