import type { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

jest.mock('@/lib/supabase/server')
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('GET /auth/confirm', () => {
  let verifyOtp: jest.Mock
  let buildRequest: (url: string) => NextRequest

  beforeEach(() => {
    verifyOtp = jest.fn()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { verifyOtp },
    })
    ;(redirect as unknown as jest.Mock).mockReset()
    ;(redirect as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })
    buildRequest = (url: string) => ({ url }) as unknown as NextRequest
  })

  it('redirects to the error page when token_hash is missing', async () => {
    await GET(buildRequest('https://app.test/auth/confirm?type=signup')).catch(
      () => {},
    )
    expect(redirect).toHaveBeenCalledWith('/auth/error')
  })

  it('redirects to the next URL after a successful OTP verification', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await GET(
      buildRequest(
        'https://app.test/auth/confirm?token_hash=abc&type=signup&next=/dashboard',
      ),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to "/" when next is an absolute external URL', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await GET(
      buildRequest(
        'https://app.test/auth/confirm?token_hash=abc&type=recovery&next=https://evil.example',
      ),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('redirects to "/" when next is an encoded protocol-relative URL', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await GET(
      buildRequest(
        'https://app.test/auth/confirm?token_hash=abc&type=recovery&next=%2F%2Fevil.example',
      ),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('keeps the template link landing on /auth/update-password', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await GET(
      buildRequest(
        'https://app.test/auth/confirm?token_hash=abc&type=recovery&next=/auth/update-password',
      ),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/auth/update-password')
  })

  it('redirects to "/" by default when next is not provided', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    await GET(
      buildRequest('https://app.test/auth/confirm?token_hash=abc&type=signup'),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('redirects to the error page with the OTP error code when verification fails', async () => {
    verifyOtp.mockResolvedValue({
      error: { code: 'otp_expired', message: 'Email link is invalid' },
    })
    await GET(
      buildRequest('https://app.test/auth/confirm?token_hash=abc&type=signup'),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/auth/error?error=otp_expired')
  })

  it('redirects to the error page without a code when the OTP error has none', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Something broke' } })
    await GET(
      buildRequest('https://app.test/auth/confirm?token_hash=abc&type=signup'),
    ).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/auth/error')
  })
})
