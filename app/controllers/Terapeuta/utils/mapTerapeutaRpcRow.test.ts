import { mapTerapeutaRpcRow } from './mapTerapeutaRpcRow'
import { ROLE } from '@/app/controllers/Auth'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

describe('mapTerapeutaRpcRow', () => {
  let row: {
    id: string
    nombre: string
    email: string
    telefono: string | null
    estado: string
    pacientes_activos: number
  }

  beforeEach(() => {
    row = {
      id: 't-1',
      nombre: 'Dra. Ana',
      email: 'ana@clinic.com',
      telefono: '123',
      estado: 'activo',
      pacientes_activos: 3,
    }
  })

  it('maps a full RPC row to a Terapeuta with estado activo', () => {
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('maps telefono=null to null in the result', () => {
    row.telefono = null
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: null,
      pacientesActivos: 3,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('maps pacientes_activos=0 to pacientesActivos 0', () => {
    row.pacientes_activos = 0
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 0,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('maps estado="pendiente" to TERAPEUTA_STATE.PENDIENTE', () => {
    row.estado = 'pendiente'
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.PENDIENTE,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('maps estado="inactivo" to TERAPEUTA_STATE.INACTIVO', () => {
    row.estado = 'inactivo'
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.INACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('falls back to TERAPEUTA_STATE.INACTIVO for an unknown estado value', () => {
    row.estado = 'unknown_value'
    expect(mapTerapeutaRpcRow(row)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.INACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  // Task 2.3: list_terapeutas (task 2.1) agrega alertas_activas al row —
  // get_terapeuta/update_terapeuta todavía no lo exponen, así que la columna
  // es opcional en el row crudo y en Terapeuta.alertasActivas.
  it('maps alertas_activas when present on the row', () => {
    const rowWithAlertas = { ...row, alertas_activas: 2 }
    expect(mapTerapeutaRpcRow(rowWithAlertas)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      alertasActivas: 2,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('leaves alertasActivas undefined when the row does not carry alertas_activas', () => {
    expect(mapTerapeutaRpcRow(row).alertasActivas).toBeUndefined()
  })

  // DEC-12 (feat/inicio-tratamiento, post-implementación): list_terapeutas
  // agrega sin_iniciar — compensación de la baja de la alerta
  // contenido_pendiente. get_terapeuta/update_terapeuta todavía no la
  // exponen, así que es opcional en el row crudo y en Terapeuta.sinIniciar,
  // igual que alertas_activas/alertasActivas.
  it('maps sin_iniciar when present on the row', () => {
    const rowWithSinIniciar = { ...row, sin_iniciar: 2 }
    expect(mapTerapeutaRpcRow(rowWithSinIniciar)).toEqual({
      id: 't-1',
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@clinic.com',
      telefono: '123',
      pacientesActivos: 3,
      sinIniciar: 2,
      profile: {
        id: 't-1',
        name: 'Dra. Ana',
        email: 'ana@clinic.com',
        role: ROLE.TERAPEUTA,
        timezone: '',
      },
    })
  })

  it('leaves sinIniciar undefined when the row does not carry sin_iniciar', () => {
    expect(mapTerapeutaRpcRow(row).sinIniciar).toBeUndefined()
  })
})
