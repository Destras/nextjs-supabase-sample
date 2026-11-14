import { createClient } from '@/lib/supabase/client'
import type { CerrarEtapaPayload } from '../PacienteTypes'
import { cerrarEtapa } from './cerrarEtapa'

jest.mock('@/lib/supabase/client')

describe('cerrarEtapa', () => {
  let rpcMock: jest.Mock
  let payload: CerrarEtapaPayload

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })

    payload = {
      pacienteId: 'paciente-uuid-1',
      estado: 'finalizada',
      motivo: null,
    }
  })

  it('returns no error when the RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await cerrarEtapa(payload)).toEqual({ error: null })
  })

  it('returns the error message when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'etapa_no_encontrada' },
    })
    expect(await cerrarEtapa(payload)).toEqual({
      error: 'etapa_no_encontrada',
    })
  })

  it('maps camelCase payload to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await cerrarEtapa(payload)
    expect(rpcMock).toHaveBeenCalledWith('cerrar_etapa', {
      p_paciente_id: 'paciente-uuid-1',
      p_estado: 'finalizada',
      p_motivo: null,
    })
  })

  it('passes a non-null motivo through to the RPC payload', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await cerrarEtapa({
      ...payload,
      estado: 'abandonada',
      motivo: 'paciente dejó el tratamiento',
    })
    expect(rpcMock).toHaveBeenCalledWith('cerrar_etapa', {
      p_paciente_id: 'paciente-uuid-1',
      p_estado: 'abandonada',
      p_motivo: 'paciente dejó el tratamiento',
    })
  })
})
