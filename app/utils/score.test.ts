import {
  LOW_SCORE_THRESHOLD,
  isLowScore,
  CRITICAL_SCORE_THRESHOLD,
  isCriticalScore,
} from './score'

describe('isLowScore', () => {
  beforeEach(() => {
    // no shared mutable state; beforeEach satisfies Rule 3
  })

  it('returns false for null', () => {
    expect(isLowScore(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isLowScore(undefined)).toBe(false)
  })

  it('returns true for 0', () => {
    expect(isLowScore(0)).toBe(true)
  })

  it('returns true for 1', () => {
    expect(isLowScore(1)).toBe(true)
  })

  it('returns true for 2', () => {
    expect(isLowScore(2)).toBe(true)
  })

  it('returns true for 3 (the threshold itself)', () => {
    expect(isLowScore(3)).toBe(true)
  })

  it('returns false for 4', () => {
    expect(isLowScore(4)).toBe(false)
  })

  it('returns false for 5', () => {
    expect(isLowScore(5)).toBe(false)
  })

  it('exports LOW_SCORE_THRESHOLD as 3', () => {
    expect(LOW_SCORE_THRESHOLD).toBe(3)
  })
})

describe('isCriticalScore', () => {
  it('returns false for null', () => {
    expect(isCriticalScore(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isCriticalScore(undefined)).toBe(false)
  })

  it('returns true for 0', () => {
    expect(isCriticalScore(0)).toBe(true)
  })

  it('returns true for 1 (the threshold itself)', () => {
    expect(isCriticalScore(1)).toBe(true)
  })

  it('returns false for 2', () => {
    expect(isCriticalScore(2)).toBe(false)
  })

  it('returns false for 3', () => {
    expect(isCriticalScore(3)).toBe(false)
  })

  it('exports CRITICAL_SCORE_THRESHOLD as 1', () => {
    expect(CRITICAL_SCORE_THRESHOLD).toBe(1)
  })
})
