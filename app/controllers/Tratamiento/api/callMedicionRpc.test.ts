import { createClient } from '@/lib/supabase/client'
import { callMedicionRpc } from './callMedicionRpc'

jest.mock('@/lib/supabase/client')

describe('callMedicionRpc', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('calls supabase.rpc with the given function name and params', async () => {
    rpcMock.mockResolvedValue({ data: 'medicion-id', error: null })
    await callMedicionRpc('registrar_medicion', { p_etapa_id: 'e-1' })
    expect(rpcMock).toHaveBeenCalledWith('registrar_medicion', {
      p_etapa_id: 'e-1',
    })
  })

  it('returns the data with a null error on success', async () => {
    rpcMock.mockResolvedValue({ data: 'medicion-id', error: null })
    const result = await callMedicionRpc('registrar_medicion', {})
    expect(result).toEqual({ data: 'medicion-id', error: null })
  })

  it('preserves code, message, details and hint on a PostgrestError', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'no_autorizado',
        details: 'some detail',
        hint: 'some hint',
      },
    })
    const result = await callMedicionRpc('registrar_medicion', {})
    expect(result).toEqual({
      data: null,
      error: {
        code: '42501',
        message: 'no_autorizado',
        details: 'some detail',
        hint: 'some hint',
      },
    })
  })

  it('normalizes an empty-string details to null', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '22023',
        message: 'valores_invalidos',
        details: '',
        hint: '',
      },
    })
    const result = await callMedicionRpc('registrar_medicion', {})
    expect(result.error).toEqual({
      code: '22023',
      message: 'valores_invalidos',
      details: null,
      hint: null,
    })
  })
})
