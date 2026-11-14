import { createClient } from '@/lib/supabase/client'
import type { UpdateEtapaDiagnosticoPayload } from '../PacienteTypes'
import { updateEtapaDiagnostico } from './updateEtapaDiagnostico'

jest.mock('@/lib/supabase/client')

describe('updateEtapaDiagnostico', () => {
  let rpcMock: jest.Mock
  let payload: UpdateEtapaDiagnosticoPayload

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })

    payload = {
      pacienteId: 'paciente-uuid-1',
      causaId: 'causa-uuid-1',
      algoritmoId: 'algoritmo-uuid-1',
      modalidadId: 'modalidad-uuid-1',
      bloqueoIds: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [2] }],
    }
  })

  it('returns no error when the RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await updateEtapaDiagnostico(payload)).toEqual({ error: null })
  })

  it('returns the error message when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'etapa_con_progreso' },
    })
    expect(await updateEtapaDiagnostico(payload)).toEqual({
      error: 'etapa_con_progreso',
    })
  })

  it('maps camelCase payload to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await updateEtapaDiagnostico(payload)
    expect(rpcMock).toHaveBeenCalledWith('update_etapa_diagnostico', {
      p_paciente_id: 'paciente-uuid-1',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      p_alfabetos: [{ alfabeto_id: 'alfabeto-uuid-1', numero: 2 }],
    })
  })

  it('sends one row per number', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await updateEtapaDiagnostico({
      ...payload,
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1, 2] }],
    })
    expect(rpcMock).toHaveBeenCalledWith(
      'update_etapa_diagnostico',
      expect.objectContaining({
        p_alfabetos: [
          { alfabeto_id: 'alfabeto-uuid-1', numero: 1 },
          { alfabeto_id: 'alfabeto-uuid-1', numero: 2 },
        ],
      }),
    )
  })

  it('passes empty arrays when bloqueoIds and alfabetos are empty', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await updateEtapaDiagnostico({
      ...payload,
      bloqueoIds: [],
      alfabetos: [],
    })
    expect(rpcMock).toHaveBeenCalledWith('update_etapa_diagnostico', {
      p_paciente_id: 'paciente-uuid-1',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: [],
      p_alfabetos: [],
    })
  })
})
