import { createClient } from '@/lib/supabase/client'
import { dispararInvitacion } from './dispararInvitacion'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('dispararInvitacion', () => {
  let mockInvoke: jest.Mock

  beforeEach(() => {
    mockInvoke = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      functions: { invoke: mockInvoke },
    })
  })

  it('reports one message sent when the Edge Function says it sent the bienvenida', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, enviadas: 1 },
      error: null,
    })
    expect(await dispararInvitacion('p-1')).toEqual({
      ok: true,
      enviadas: 1,
      error: null,
    })
  })

  it('reports zero messages sent when the guards short-circuited the send', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, enviadas: 0 },
      error: null,
    })
    expect(await dispararInvitacion('p-1')).toEqual({
      ok: true,
      enviadas: 0,
      error: null,
    })
  })

  it('reports an unknown count when the body does not carry one', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })
    expect(await dispararInvitacion('p-1')).toEqual({
      ok: true,
      enviadas: null,
      error: null,
    })
  })

  it('returns { ok: false, error } when invoke resolves with an error object', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'invoke_failed' },
    })
    expect(await dispararInvitacion('p-1')).toEqual({
      ok: false,
      enviadas: null,
      error: 'invoke_failed',
    })
  })

  it('returns { ok: false, error } when invoke throws', async () => {
    mockInvoke.mockRejectedValue(new Error('unexpected'))
    expect(await dispararInvitacion('p-1')).toEqual({
      ok: false,
      enviadas: null,
      error: 'unexpected',
    })
  })
})
