import { rutaInternaSegura } from './rutaInternaSegura'

describe('rutaInternaSegura', () => {
  let porDefecto: string

  beforeEach(() => {
    porDefecto = '/'
  })

  it('accepts an internal path', () => {
    expect(rutaInternaSegura('/auth/update-password', porDefecto)).toBe(
      '/auth/update-password',
    )
  })

  it('accepts an internal path with a query string', () => {
    expect(rutaInternaSegura('/x?y=1', porDefecto)).toBe('/x?y=1')
  })

  it('falls back to the default for an absolute URL', () => {
    expect(rutaInternaSegura('https://evil', porDefecto)).toBe('/')
  })

  it('falls back to the default for a protocol-relative URL', () => {
    expect(rutaInternaSegura('//evil', porDefecto)).toBe('/')
  })

  it('falls back to the default when a backslash follows the first slash', () => {
    expect(rutaInternaSegura('/\\evil', porDefecto)).toBe('/')
  })

  it('falls back to the default for a javascript: URL', () => {
    expect(rutaInternaSegura('javascript:alert(1)', porDefecto)).toBe('/')
  })

  it('falls back to the default for an empty string', () => {
    expect(rutaInternaSegura('', porDefecto)).toBe('/')
  })

  it('falls back to the default when the value is missing', () => {
    expect(rutaInternaSegura(null, porDefecto)).toBe('/')
  })

  it('falls back to the default for a still-encoded double slash', () => {
    expect(rutaInternaSegura('%2F%2Fevil', porDefecto)).toBe('/')
  })

  it('falls back to the default when a tab hides a double slash', () => {
    expect(rutaInternaSegura('/\t/evil', porDefecto)).toBe('/')
  })

  it('falls back to the default when the path carries a newline', () => {
    expect(rutaInternaSegura('/x\nLocation: evil', porDefecto)).toBe('/')
  })

  it('falls back to the default when a backslash appears later in the path', () => {
    expect(rutaInternaSegura('/x\\..\\evil', porDefecto)).toBe('/')
  })

  it('returns the given default instead of "/"', () => {
    expect(rutaInternaSegura('https://evil', '/pacientes')).toBe('/pacientes')
  })
})
