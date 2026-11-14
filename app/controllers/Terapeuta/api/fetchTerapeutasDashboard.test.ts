import { createClient } from '@/lib/supabase/client'
import { fetchTerapeutasDashboard } from './fetchTerapeutasDashboard'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

jest.mock('@/lib/supabase/client')

describe('fetchTerapeutasDashboard', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('returns the mapped rollup array on success', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 't-1',
          nombre: 'Laura Martínez',
          email: 'laura@clinic.com',
          telefono: null,
          estado: 'activo',
          pacientes_activos: 6,
          score_promedio: 3.8,
          alertas_activas: 1,
        },
      ],
      error: null,
    })
    expect(await fetchTerapeutasDashboard()).toEqual([
      {
        id: 't-1',
        nombre: 'Laura Martínez',
        estado: TERAPEUTA_STATE.ACTIVO,
        pacientesActivos: 6,
        scorePromedio: 3.8,
        alertasActivas: 1,
      },
    ])
  })

  it('throws when supabase.rpc returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: '42501' },
    })
    await expect(fetchTerapeutasDashboard()).rejects.toEqual({
      message: 'no_autorizado',
      code: '42501',
    })
  })

  it('returns an empty array when data is null and there is no error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchTerapeutasDashboard()).toEqual([])
  })
})
