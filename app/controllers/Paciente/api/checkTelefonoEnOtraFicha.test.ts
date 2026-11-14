import { createClient } from '@/lib/supabase/client'
import { checkTelefonoEnOtraFicha } from './checkTelefonoEnOtraFicha'

jest.mock('@/lib/supabase/client')

describe('checkTelefonoEnOtraFicha', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('returns enOtraFicha true when the RPC resolves true', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    expect(await checkTelefonoEnOtraFicha('+541151234567', null)).toEqual({
      enOtraFicha: true,
      error: null,
    })
  })

  it('returns enOtraFicha false when the RPC resolves false', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    expect(await checkTelefonoEnOtraFicha('+541151234567', null)).toEqual({
      enOtraFicha: false,
      error: null,
    })
  })

  it('returns the error message when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado' },
    })
    expect(await checkTelefonoEnOtraFicha('+541151234567', null)).toEqual({
      enOtraFicha: false,
      error: 'no_autorizado',
    })
  })

  it('maps the phone and excluded id to snake_case RPC parameters', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    await checkTelefonoEnOtraFicha('+541151234567', 'paciente-uuid-1')
    expect(rpcMock).toHaveBeenCalledWith('telefono_en_otra_ficha', {
      p_telefono: '+541151234567',
      p_excluir_paciente_id: 'paciente-uuid-1',
    })
  })

  it('passes null through for excluirPacienteId when there is no ficha to exclude', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    await checkTelefonoEnOtraFicha('+541151234567', null)
    expect(rpcMock).toHaveBeenCalledWith('telefono_en_otra_ficha', {
      p_telefono: '+541151234567',
      p_excluir_paciente_id: null,
    })
  })
})
