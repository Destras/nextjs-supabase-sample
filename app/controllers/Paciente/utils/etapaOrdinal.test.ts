import { etapaOrdinal } from './etapaOrdinal'

describe('etapaOrdinal', () => {
  let etapas: ReadonlyArray<{
    id: string
    fechaInicio: string | null
    createdAt: string
  }>

  beforeEach(() => {
    etapas = [
      {
        id: 'e-1',
        fechaInicio: '2024-01-01',
        createdAt: '2024-01-01T00:00:00+00:00',
      },
    ]
  })

  it('returns null when etapaActivaId is null', () => {
    expect(etapaOrdinal(etapas, null)).toEqual(null)
  })

  it('returns 1 when there is a single etapa and it is active', () => {
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-1',
            fechaInicio: '2024-01-01',
            createdAt: '2024-01-01T00:00:00+00:00',
          },
        ],
        'e-1',
      ),
    ).toEqual(1)
  })

  it('returns 2 when there is a closed earlier etapa and one active later etapa', () => {
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-1',
            fechaInicio: '2023-01-01',
            createdAt: '2023-01-01T00:00:00+00:00',
          },
          {
            id: 'e-2',
            fechaInicio: '2024-06-01',
            createdAt: '2024-06-01T09:00:00+00:00',
          },
        ],
        'e-2',
      ),
    ).toEqual(2)
  })

  it('returns null when the active etapa id is not found in the list', () => {
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-1',
            fechaInicio: '2024-01-01',
            createdAt: '2024-01-01T00:00:00+00:00',
          },
        ],
        'e-99',
      ),
    ).toEqual(null)
  })

  it('breaks ties by id asc when two etapas share the same fechaInicio', () => {
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-b',
            fechaInicio: '2024-03-01',
            createdAt: '2024-03-01T00:00:00+00:00',
          },
          {
            id: 'e-a',
            fechaInicio: '2024-03-01',
            createdAt: '2024-03-01T00:00:00+00:00',
          },
        ],
        'e-b',
      ),
    ).toEqual(2)
  })

  it('returns the correct ordinal regardless of mesActual: active is 3rd etapa even when mesActual would be low (DevSpec §9.3 anti-ceil/2)', () => {
    // A patient started their 3rd etapa just yesterday (mesActual = 1),
    // but etapaOrdinal must still be 3 — never derived from mesActual.
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-1',
            fechaInicio: '2022-01-01',
            createdAt: '2022-01-01T00:00:00+00:00',
          },
          {
            id: 'e-2',
            fechaInicio: '2023-06-01',
            createdAt: '2023-06-01T00:00:00+00:00',
          },
          {
            id: 'e-3',
            fechaInicio: '2026-06-25',
            createdAt: '2026-06-25T00:00:00+00:00',
          },
        ],
        'e-3',
      ),
    ).toEqual(3)
  })

  it('DEC-11: a closed etapa that never started, created first, keeps ordinal 1 even though a later etapa has a real fechaInicio', () => {
    // e-1 was closed via the DEC-10 escape hatch without ever starting
    // (fechaInicio null), but it was created (createdAt) before e-2 started.
    // Ordering by fechaInicio alone would push e-1's null to the end and
    // mislabel e-2 as "tratamiento 1". Coalescing to createdAt fixes it.
    expect(
      etapaOrdinal(
        [
          {
            id: 'e-1',
            fechaInicio: null,
            createdAt: '2024-01-01T00:00:00+00:00',
          },
          {
            id: 'e-2',
            fechaInicio: '2024-06-01',
            createdAt: '2024-06-01T09:00:00+00:00',
          },
        ],
        'e-1',
      ),
    ).toEqual(1)
  })
})
