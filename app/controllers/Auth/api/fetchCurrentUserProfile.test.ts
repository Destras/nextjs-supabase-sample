import { ROLE } from '../AuthTypes'
import { fetchCurrentUserProfile } from './fetchCurrentUserProfile'

describe('fetchCurrentUserProfile', () => {
  let from: jest.Mock
  let select: jest.Mock
  let eq: jest.Mock
  let single: jest.Mock
  let getUser: jest.Mock
  let supabase: { from: jest.Mock; auth: { getUser: jest.Mock } }

  beforeEach(() => {
    single = jest.fn()
    eq = jest.fn(() => ({ single }))
    select = jest.fn(() => ({ eq }))
    from = jest.fn(() => ({ select }))
    getUser = jest.fn()
    supabase = { from, auth: { getUser } }
  })

  it('returns the mapped Profile when the query succeeds', async () => {
    from.mockReturnValue({ select })
    select.mockReturnValue({ eq })
    eq.mockReturnValue({ single })
    single.mockResolvedValue({
      data: {
        id: 'u-1',
        nombre: 'Ana García',
        timezone: 'America/Argentina/Buenos_Aires',
        roles: { codigo: 'terapeuta' },
      },
      error: null,
    })
    getUser.mockResolvedValue({ data: { user: { email: 'ana@example.com' } } })

    const result = await fetchCurrentUserProfile(supabase as never, 'u-1')

    expect(result).toEqual({
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.TERAPEUTA,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    })
  })

  it('throws an error when the profiles query fails', async () => {
    single.mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    })
    getUser.mockResolvedValue({ data: { user: { email: 'x@y.com' } } })

    await expect(
      fetchCurrentUserProfile(supabase as never, 'u-1'),
    ).rejects.toThrow('db error')
  })

  it('falls back to empty string when getUser returns a user without email', async () => {
    single.mockResolvedValue({
      data: {
        id: 'u-1',
        nombre: 'Ana',
        timezone: 'UTC',
        roles: { codigo: 'admin' },
      },
      error: null,
    })
    getUser.mockResolvedValue({ data: { user: {} } })

    const result = await fetchCurrentUserProfile(supabase as never, 'u-1')

    expect(result).toEqual({
      id: 'u-1',
      name: 'Ana',
      role: ROLE.ADMIN,
      timezone: 'UTC',
      email: '',
    })
  })
})
