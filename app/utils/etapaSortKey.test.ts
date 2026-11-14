import { etapaSortKey } from './etapaSortKey'

describe('etapaSortKey', () => {
  let fechaInicio: string | null
  let createdAt: string | null | undefined

  beforeEach(() => {
    fechaInicio = null
    createdAt = undefined
  })

  it('returns fechaInicio when it is not null', () => {
    fechaInicio = '2026-06-01'
    createdAt = '2026-01-01T00:00:00+00:00'
    expect(etapaSortKey(fechaInicio, createdAt)).toEqual('2026-06-01')
  })

  it('returns createdAt collapsed to its calendar date when fechaInicio is null', () => {
    fechaInicio = null
    createdAt = '2026-01-01T09:30:00+00:00'
    expect(etapaSortKey(fechaInicio, createdAt)).toEqual('2026-01-01')
  })

  it('returns an empty string when fechaInicio is null and createdAt is null', () => {
    fechaInicio = null
    createdAt = null
    expect(etapaSortKey(fechaInicio, createdAt)).toEqual('')
  })

  it('returns an empty string when fechaInicio is null and createdAt is undefined', () => {
    fechaInicio = null
    createdAt = undefined
    expect(etapaSortKey(fechaInicio, createdAt)).toEqual('')
  })
})
