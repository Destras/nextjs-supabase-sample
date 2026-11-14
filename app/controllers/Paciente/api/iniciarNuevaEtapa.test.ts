import { createClient } from '@/lib/supabase/client'
import { iniciarNuevaEtapa } from './iniciarNuevaEtapa'

jest.mock('@/lib/supabase/client')

describe('iniciarNuevaEtapa', () => {
  let rpcMock: jest.Mock
  let payload: Parameters<typeof iniciarNuevaEtapa>[0]

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: rpcMock,
    })

    payload = {
      pacienteId: 'paciente-uuid-1',
      causaId: 'causa-uuid-1',
      algoritmoId: 'algoritmo-uuid-1',
      modalidadId: 'modalidad-uuid-1',
      bloqueoIds: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [3] }],
    }
  })

  it('returns etapaId when RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({
      data: 'etapa-uuid-abc',
      error: null,
    })

    expect(await iniciarNuevaEtapa(payload)).toEqual({
      etapaId: 'etapa-uuid-abc',
      error: null,
    })
  })

  it('returns error message when RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'etapa_activa_existente' },
    })

    expect(await iniciarNuevaEtapa(payload)).toEqual({
      etapaId: null,
      error: 'etapa_activa_existente',
    })
  })

  it('maps a range rejection to numeros_invalidos', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'alfabeto_numero_fuera_de_rango' },
    })

    expect(await iniciarNuevaEtapa(payload)).toEqual({
      etapaId: null,
      error: 'numeros_invalidos',
    })
  })

  it('maps camelCase payload to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: 'etapa-uuid-abc', error: null })

    await iniciarNuevaEtapa(payload)

    expect(rpcMock).toHaveBeenCalledWith('iniciar_nueva_etapa', {
      p_paciente_id: 'paciente-uuid-1',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: ['bloqueo-uuid-1', 'bloqueo-uuid-2'],
      p_alfabetos: [{ alfabeto_id: 'alfabeto-uuid-1', numero: 3 }],
    })
  })

  it('sends one row per number', async () => {
    rpcMock.mockResolvedValue({ data: 'etapa-uuid-abc', error: null })

    await iniciarNuevaEtapa({
      ...payload,
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1, 2] }],
    })

    expect(rpcMock).toHaveBeenCalledWith(
      'iniciar_nueva_etapa',
      expect.objectContaining({
        p_alfabetos: [
          { alfabeto_id: 'alfabeto-uuid-1', numero: 1 },
          { alfabeto_id: 'alfabeto-uuid-1', numero: 2 },
        ],
      }),
    )
  })

  it('passes empty arrays for bloqueoIds and alfabetos when both are empty', async () => {
    rpcMock.mockResolvedValue({ data: 'etapa-uuid-abc', error: null })

    await iniciarNuevaEtapa({
      ...payload,
      bloqueoIds: [],
      alfabetos: [],
    })

    expect(rpcMock).toHaveBeenCalledWith('iniciar_nueva_etapa', {
      p_paciente_id: 'paciente-uuid-1',
      p_causa_id: 'causa-uuid-1',
      p_algoritmo_id: 'algoritmo-uuid-1',
      p_modalidad_id: 'modalidad-uuid-1',
      p_bloqueo_ids: [],
      p_alfabetos: [],
    })
  })
})
