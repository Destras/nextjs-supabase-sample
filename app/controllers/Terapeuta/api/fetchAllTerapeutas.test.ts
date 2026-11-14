import { createClient } from '@/lib/supabase/client'
import { fetchAllTerapeutas } from './fetchAllTerapeutas'
import { ROLE } from '@/app/controllers/Auth'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

jest.mock('@/lib/supabase/client')

describe('fetchAllTerapeutas', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    })
  })

  it('returns the mapped terapeutas array on success', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 't-1',
          nombre: 'Dra. Ana',
          email: 'ana@clinic.com',
          telefono: null,
          estado: 'activo',
          pacientes_activos: 2,
        },
      ],
      error: null,
    })
    expect(await fetchAllTerapeutas()).toEqual([
      {
        id: 't-1',
        role: ROLE.TERAPEUTA,
        state: TERAPEUTA_STATE.ACTIVO,
        email: 'ana@clinic.com',
        telefono: null,
        pacientesActivos: 2,
        profile: {
          id: 't-1',
          name: 'Dra. Ana',
          email: 'ana@clinic.com',
          role: ROLE.TERAPEUTA,
          timezone: '',
        },
      },
    ])
  })

  it('throws when supabase.rpc returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'rpc boom', code: '42501' },
    })
    await expect(fetchAllTerapeutas()).rejects.toEqual({
      message: 'rpc boom',
      code: '42501',
    })
  })

  it('returns an empty array when data is null and there is no error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchAllTerapeutas()).toEqual([])
  })
})
