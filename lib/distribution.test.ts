import { attachPct } from './distribution'

describe('attachPct', () => {
  it('returns an empty array for no items', () => {
    expect(attachPct([])).toEqual([])
  })

  it('attaches 100% to a single bucket', () => {
    expect(attachPct([{ label: 'A', cantidad: 5 }])).toEqual([
      { label: 'A', cantidad: 5, pct: 100 },
    ])
  })

  it('computes the rounded percentage of each bucket over the total', () => {
    expect(
      attachPct([
        { label: 'A', cantidad: 3 },
        { label: 'B', cantidad: 1 },
      ]),
    ).toEqual([
      { label: 'A', cantidad: 3, pct: 75 },
      { label: 'B', cantidad: 1, pct: 25 },
    ])
  })

  it('yields 0% (not NaN) when every bucket is empty', () => {
    expect(attachPct([{ label: 'A', cantidad: 0 }])).toEqual([
      { label: 'A', cantidad: 0, pct: 0 },
    ])
  })
})
