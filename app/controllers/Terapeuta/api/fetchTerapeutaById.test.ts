import { createClient } from '@/lib/supabase/client'
import { fetchTerapeutaById } from './fetchTerapeutaById'
import { ROLE } from '@/app/controllers/Auth'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

jest.mock('@/lib/supabase/client')

describe('fetchTerapeutaById', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    })
  })

  it('returns an Error when supabase rpc returns an error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchTerapeutaById('t-1')).toEqual({
      data: null,
      error: new Error('boom'),
    })
  })

  it('returns { data: null, error: null } when rpc returns empty array', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchTerapeutaById('t-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns { data: null, error: null } when rpc returns null data', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await fetchTerapeutaById('t-1')).toEqual({
      data: null,
      error: null,
    })
  })

  it('returns the mapped Terapeuta when rpc returns a row', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 't-1',
          nombre: 'Dra. Ana',
          email: 'ana@clinic.com',
          telefono: null,
          estado: 'activo',
          pacientes_activos: 3,
        },
      ],
      error: null,
    })
    expect(await fetchTerapeutaById('t-1')).toEqual({
      data: {
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
      },
      error: null,
    })
  })
})
