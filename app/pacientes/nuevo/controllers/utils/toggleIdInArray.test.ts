import { toggleIdInArray } from './toggleIdInArray'

describe('toggleIdInArray', () => {
  it('adds the id when it is not present', () => {
    expect(toggleIdInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
  })

  it('removes the id when it is present', () => {
    expect(toggleIdInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('returns a new array (does not mutate input)', () => {
    const input: ReadonlyArray<string> = ['a', 'b']
    const result = toggleIdInArray(input, 'c')
    expect(result).not.toBe(input)
    expect(input).toEqual(['a', 'b'])
  })

  it('handles empty input', () => {
    expect(toggleIdInArray([], 'a')).toEqual(['a'])
  })

  it('removing the only element returns empty array', () => {
    expect(toggleIdInArray(['a'], 'a')).toEqual([])
  })
})
