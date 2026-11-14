import { createClient } from '@/lib/supabase/client'
import type { SetEtapaAlfabetosPayload } from '../PacienteTypes'
import { setEtapaAlfabetos } from './setEtapaAlfabetos'

jest.mock('@/lib/supabase/client')

describe('setEtapaAlfabetos', () => {
  let rpcMock: jest.Mock
  let payload: SetEtapaAlfabetosPayload

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
    payload = {
      pacienteId: 'paciente-uuid-1',
      alfabetos: [{ alfabetoId: 'alfabeto-uuid-1', numeros: [1, 2] }],
    }
  })

  it('returns no error when the RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await setEtapaAlfabetos(payload)).toEqual({ error: null })
  })

  it('sends one RPC entry per number with snake_case params', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await setEtapaAlfabetos(payload)
    expect(rpcMock).toHaveBeenCalledWith('set_etapa_alfabetos', {
      p_paciente_id: 'paciente-uuid-1',
      p_alfabetos: [
        { alfabeto_id: 'alfabeto-uuid-1', numero: 1 },
        { alfabeto_id: 'alfabeto-uuid-1', numero: 2 },
      ],
    })
  })

  it('sends an empty array when there are no alfabetos', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await setEtapaAlfabetos({ ...payload, alfabetos: [] })
    expect(rpcMock).toHaveBeenCalledWith('set_etapa_alfabetos', {
      p_paciente_id: 'paciente-uuid-1',
      p_alfabetos: [],
    })
  })

  it('returns etapa_activa_no_encontrada as message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'etapa_activa_no_encontrada' },
    })
    expect(await setEtapaAlfabetos(payload)).toEqual({
      error: 'etapa_activa_no_encontrada',
    })
  })

  it('returns no_autorizado as message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })
    expect(await setEtapaAlfabetos(payload)).toEqual({
      error: 'no_autorizado',
    })
  })

  it('returns numeros_invalidos when the range trigger rejects a number', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'alfabeto_numero_fuera_de_rango' },
    })
    expect(await setEtapaAlfabetos(payload)).toEqual({
      error: 'numeros_invalidos',
    })
  })

  it('returns numeros_invalidos on a unique violation over etapa_alfabetos', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "etapa_alfabetos_pkey"',
      },
    })
    expect(await setEtapaAlfabetos(payload)).toEqual({
      error: 'numeros_invalidos',
    })
  })
})
