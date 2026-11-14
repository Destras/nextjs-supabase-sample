import { removeQueryParam } from './removeQueryParam'

describe('removeQueryParam', () => {
  const pathname = '/pacientes/p-1/camino'

  beforeEach(() => {
    // no shared mutable state; beforeEach satisfies Rule 3
  })

  it('returns the bare pathname when the key was the only param', () => {
    expect(
      removeQueryParam(
        pathname,
        new URLSearchParams('finalizar=1'),
        'finalizar',
      ),
    ).toBe('/pacientes/p-1/camino')
  })

  it('keeps every other query param in its original order', () => {
    expect(
      removeQueryParam(
        pathname,
        new URLSearchParams('tab=1&finalizar=1&medicion=m-42'),
        'finalizar',
      ),
    ).toBe('/pacientes/p-1/camino?tab=1&medicion=m-42')
  })
})
