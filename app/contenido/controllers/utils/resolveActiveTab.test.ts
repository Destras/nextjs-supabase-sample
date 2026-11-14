import { resolveActiveTab } from './resolveActiveTab'

describe('resolveActiveTab', () => {
  it('returns the listing segment when on a tab listing route', () => {
    expect(resolveActiveTab('/contenido/videos', null)).toBe('videos')
  })

  it('returns the mantras segment on /contenido/mantras', () => {
    expect(resolveActiveTab('/contenido/mantras', null)).toBe('mantras')
  })

  it('falls back to the ?tipo param on the create route', () => {
    expect(resolveActiveTab('/contenido/nuevo', 'mantras')).toBe('mantras')
  })

  it('falls back to the ?tipo param on a detail route', () => {
    expect(resolveActiveTab('/contenido/abc-123', 'videos')).toBe('videos')
  })

  it('falls back to the ?tipo param on an edit route', () => {
    expect(resolveActiveTab('/contenido/abc-123/editar', 'mantras')).toBe(
      'mantras',
    )
  })

  it('returns null when no segment matches and there is no ?tipo param', () => {
    expect(resolveActiveTab('/contenido/nuevo', null)).toBeNull()
  })

  it('returns null for an invalid ?tipo param value', () => {
    expect(resolveActiveTab('/contenido/nuevo', 'bogus')).toBeNull()
  })

  it('returns null for the retired frases tab (no longer a valid tab)', () => {
    expect(resolveActiveTab('/contenido/frases', null)).toBeNull()
    expect(resolveActiveTab('/contenido/nuevo', 'frases')).toBeNull()
  })

  it('returns the egregores segment on /contenido/egregores', () => {
    expect(resolveActiveTab('/contenido/egregores', null)).toBe('egregores')
  })

  it('returns the cma segment on /contenido/cma', () => {
    expect(resolveActiveTab('/contenido/cma', null)).toBe('cma')
  })

  it('returns the ic segment on /contenido/ic', () => {
    expect(resolveActiveTab('/contenido/ic', null)).toBe('ic')
  })

  it('falls back to the ?tipo=egregores param on the create route', () => {
    expect(resolveActiveTab('/contenido/nuevo', 'egregores')).toBe('egregores')
  })
})
