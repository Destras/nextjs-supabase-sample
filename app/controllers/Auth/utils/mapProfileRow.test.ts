import { ROLE } from '../AuthTypes'
import type { ProfileRowRaw } from './mapProfileRow'
import { mapProfileRow } from './mapProfileRow'

describe('mapProfileRow', () => {
  let row: ProfileRowRaw

  beforeEach(() => {
    row = {
      id: 'u-1',
      nombre: 'Ana García',
      timezone: 'America/Argentina/Buenos_Aires',
      roles: { codigo: 'terapeuta' },
    }
  })

  it('maps all fields correctly on the happy path', () => {
    expect(mapProfileRow(row, 'ana@example.com')).toEqual({
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.TERAPEUTA,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    })
  })

  it('falls back to empty string when nombre is null', () => {
    row.nombre = null
    expect(mapProfileRow(row, 'ana@example.com')).toEqual({
      id: 'u-1',
      name: '',
      role: ROLE.TERAPEUTA,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    })
  })

  it('falls back to empty string when timezone is null', () => {
    row.timezone = null
    expect(mapProfileRow(row, 'ana@example.com')).toEqual({
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.TERAPEUTA,
      timezone: '',
      email: 'ana@example.com',
    })
  })

  it('defaults role to ROLE.PACIENTE when roles join is null', () => {
    row.roles = null
    expect(mapProfileRow(row, 'ana@example.com')).toEqual({
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.PACIENTE,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    })
  })

  it('defaults role to ROLE.PACIENTE when roles.codigo is unknown', () => {
    row.roles = { codigo: 'superadmin' }
    expect(mapProfileRow(row, 'ana@example.com')).toEqual({
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.PACIENTE,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    })
  })
})
