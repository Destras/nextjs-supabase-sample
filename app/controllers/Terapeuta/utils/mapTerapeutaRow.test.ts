import type { TerapeutaRowRaw } from './mapTerapeutaRow'
import { mapTerapeutaRow } from './mapTerapeutaRow'
import { ROLE } from '@/app/controllers/Auth'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

describe('mapTerapeutaRow', () => {
  let raw: TerapeutaRowRaw

  beforeEach(() => {
    raw = {
      id: 't-1',
      telefono: null,
      estados_terapeuta: { codigo: 'activo' },
      profiles: {
        id: 'p-1',
        nombre: 'Dra. Ana',
        timezone: 'America/Argentina/Buenos_Aires',
        roles: { codigo: 'terapeuta' },
      },
    }
  })

  it('returns the mapped Terapeuta with estado activo from estados_terapeuta join', () => {
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('maps estados_terapeuta.codigo "pendiente" to TERAPEUTA_STATE.PENDIENTE', () => {
    raw.estados_terapeuta = { codigo: 'pendiente' }
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.PENDIENTE,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('maps estados_terapeuta.codigo "inactivo" to TERAPEUTA_STATE.INACTIVO', () => {
    raw.estados_terapeuta = { codigo: 'inactivo' }
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.INACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('defaults to TERAPEUTA_STATE.INACTIVO when estados_terapeuta join is null', () => {
    raw.estados_terapeuta = null
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.INACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('defaults to ROLE.PACIENTE when roles.codigo is unknown', () => {
    raw.profiles!.roles = { codigo: 'whatever' }
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.PACIENTE,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('maps roles.codigo "admin" to ROLE.ADMIN', () => {
    raw.profiles!.roles = { codigo: 'admin' }
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.ADMIN,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })

  it('returns null when profiles join is missing', () => {
    raw.profiles = null
    expect(mapTerapeutaRow(raw)).toBeNull()
  })

  it('handles null nombre/timezone with empty string fallbacks', () => {
    raw.profiles!.nombre = null
    raw.profiles!.timezone = null
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: null,
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: '',
        role: ROLE.TERAPEUTA,
        timezone: '',
        email: '',
      },
    })
  })

  it('populates telefono from the raw row when present', () => {
    raw.telefono = '+54 11 1234-5678'
    expect(mapTerapeutaRow(raw)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: '',
      telefono: '+54 11 1234-5678',
      pacientesActivos: 0,
      profile: {
        id: 'p-1',
        name: 'Dra. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'America/Argentina/Buenos_Aires',
        email: '',
      },
    })
  })
})
