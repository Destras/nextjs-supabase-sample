import { mapAdminDashboardStats } from './mapAdminDashboardStats'

describe('mapAdminDashboardStats', () => {
  it('maps totales and computes pct per distribución', () => {
    expect(
      mapAdminDashboardStats({
        totales: {
          pacientes_activos: 12,
          nuevos_mes: 0,
          alertas_activas: 3,
          score_promedio: 3.6,
        },
        distribucionEtapa: [
          { label: '1', cantidad: 3 },
          { label: '2', cantidad: 9 },
        ],
        distribucionMes: [
          { label: 'Mes 1', cantidad: 3 },
          { label: 'Mes 2', cantidad: 9 },
        ],
      }),
    ).toEqual({
      pacientesActivos: 12,
      nuevosEsteMes: 0,
      alertasTotales: 3,
      scorePromedio: 3.6,
      distribucionEtapa: [
        { label: '1', cantidad: 3, pct: 25 },
        { label: '2', cantidad: 9, pct: 75 },
      ],
      distribucionMes: [
        { label: 'Mes 1', cantidad: 3, pct: 25 },
        { label: 'Mes 2', cantidad: 9, pct: 75 },
      ],
    })
  })

  it('keeps Tier B totals null and yields empty distribuciones when the network has no data', () => {
    expect(
      mapAdminDashboardStats({
        totales: {
          pacientes_activos: 0,
          nuevos_mes: 0,
          alertas_activas: null,
          score_promedio: null,
        },
        distribucionEtapa: [],
        distribucionMes: [],
      }),
    ).toEqual({
      pacientesActivos: 0,
      nuevosEsteMes: 0,
      alertasTotales: null,
      scorePromedio: null,
      distribucionEtapa: [],
      distribucionMes: [],
    })
  })
})
