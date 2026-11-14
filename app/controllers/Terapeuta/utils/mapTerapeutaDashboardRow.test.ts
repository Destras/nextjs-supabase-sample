import { TERAPEUTA_STATE } from '../TerapeutaTypes'
import { mapTerapeutaDashboardRow } from './mapTerapeutaDashboardRow'

describe('mapTerapeutaDashboardRow', () => {
  it('maps a terapeuta with caseload metrics, rounding the score to one decimal', () => {
    expect(
      mapTerapeutaDashboardRow({
        id: 't-1',
        nombre: 'Laura Martínez',
        email: 'laura@clinic.com',
        telefono: null,
        estado: 'activo',
        pacientes_activos: 6,
        score_promedio: 3.8000000000000003,
        alertas_activas: 1,
      }),
    ).toEqual({
      id: 't-1',
      nombre: 'Laura Martínez',
      estado: TERAPEUTA_STATE.ACTIVO,
      pacientesActivos: 6,
      scorePromedio: 3.8,
      alertasActivas: 1,
    })
  })

  it('keeps Tier B metrics null when the terapeuta has no evaluaciones', () => {
    expect(
      mapTerapeutaDashboardRow({
        id: 't-2',
        nombre: 'Ana García',
        email: 'ana@clinic.com',
        telefono: null,
        estado: 'activo',
        pacientes_activos: 0,
        score_promedio: null,
        alertas_activas: null,
      }),
    ).toEqual({
      id: 't-2',
      nombre: 'Ana García',
      estado: TERAPEUTA_STATE.ACTIVO,
      pacientesActivos: 0,
      scorePromedio: null,
      alertasActivas: null,
    })
  })

  it('maps a pendiente estado', () => {
    expect(
      mapTerapeutaDashboardRow({
        id: 't-3',
        nombre: 'Pendiente',
        email: 'p@clinic.com',
        telefono: null,
        estado: 'pendiente',
        pacientes_activos: 0,
        score_promedio: null,
        alertas_activas: null,
      }).estado,
    ).toBe(TERAPEUTA_STATE.PENDIENTE)
  })

  it('falls back to inactivo for an unknown estado', () => {
    expect(
      mapTerapeutaDashboardRow({
        id: 't-4',
        nombre: 'Raro',
        email: 'r@clinic.com',
        telefono: null,
        estado: 'lo-que-sea',
        pacientes_activos: 0,
        score_promedio: null,
        alertas_activas: null,
      }).estado,
    ).toBe(TERAPEUTA_STATE.INACTIVO)
  })
})
