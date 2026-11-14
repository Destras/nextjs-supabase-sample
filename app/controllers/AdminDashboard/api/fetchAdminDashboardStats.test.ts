import { createClient } from '@/lib/supabase/client'
import { fetchAdminDashboardStats } from './fetchAdminDashboardStats'

jest.mock('@/lib/supabase/client')

describe('fetchAdminDashboardStats', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('returns the mapped stats on success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        totales: {
          pacientes_activos: 12,
          nuevos_mes: 0,
          alertas_activas: 3,
          score_promedio: 3.6,
        },
        distribucionEtapa: [{ label: '1', cantidad: 12 }],
        distribucionMes: [{ label: 'Mes 1', cantidad: 12 }],
      },
      error: null,
    })
    expect(await fetchAdminDashboardStats()).toEqual({
      pacientesActivos: 12,
      nuevosEsteMes: 0,
      alertasTotales: 3,
      scorePromedio: 3.6,
      distribucionEtapa: [{ label: '1', cantidad: 12, pct: 100 }],
      distribucionMes: [{ label: 'Mes 1', cantidad: 12, pct: 100 }],
    })
  })

  it('throws when supabase.rpc returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: '42501' },
    })
    await expect(fetchAdminDashboardStats()).rejects.toEqual({
      message: 'no_autorizado',
      code: '42501',
    })
  })
})
