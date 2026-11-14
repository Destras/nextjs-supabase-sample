import { createClient } from '@/lib/supabase/client'
import { callUpdateRpc } from './callUpdateRpc'

jest.mock('@/lib/supabase/client')

describe('callUpdateRpc', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
  })

  it('returns no error when the RPC resolves successfully', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    expect(await callUpdateRpc('some_rpc', { p_x: 1 })).toEqual({ error: null })
  })

  it('returns the error message when the RPC returns an error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await callUpdateRpc('some_rpc', { p_x: 1 })).toEqual({
      error: 'boom',
    })
  })

  it('returns email_duplicado when the RPC hits the unique email constraint', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "pacientes_email_key"',
      },
    })
    expect(await callUpdateRpc('some_rpc', { p_x: 1 })).toEqual({
      error: 'email_duplicado',
    })
  })

  it('forwards the function name and params to supabase.rpc', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await callUpdateRpc('some_rpc', { p_x: 1, p_y: 'z' })
    expect(rpcMock).toHaveBeenCalledWith('some_rpc', { p_x: 1, p_y: 'z' })
  })
})
