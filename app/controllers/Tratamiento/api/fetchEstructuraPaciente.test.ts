import { createClient } from '@/lib/supabase/client'
import { fetchEstructuraPaciente } from './fetchEstructuraPaciente'

jest.mock('@/lib/supabase/client')

describe('fetchEstructuraPaciente', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('calls get_estructura_paciente with the paciente id', async () => {
    rpcMock.mockResolvedValue({
      data: {
        paciente_id: 'p-1',
        puede_medir: true,
        es_admin: false,
        centros_activos: [],
        etapas: [],
      },
      error: null,
    })
    await fetchEstructuraPaciente('p-1')
    expect(rpcMock).toHaveBeenCalledWith('get_estructura_paciente', {
      p_paciente_id: 'p-1',
    })
  })

  it('returns the mapped domain object with a null error on success', async () => {
    rpcMock.mockResolvedValue({
      data: {
        paciente_id: 'p-1',
        puede_medir: true,
        es_admin: false,
        centros_activos: [],
        etapas: [],
      },
      error: null,
    })
    const result = await fetchEstructuraPaciente('p-1')
    expect(result).toEqual({
      data: {
        pacienteId: 'p-1',
        puedeMedir: true,
        esAdmin: false,
        centrosActivos: [],
        etapas: [],
      },
      error: null,
    })
  })

  it('returns a null data and the error message on failure', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })
    const result = await fetchEstructuraPaciente('p-1')
    expect(result).toEqual({ data: null, error: 'no_autorizado' })
  })
})
