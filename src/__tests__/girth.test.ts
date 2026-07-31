import { describe, expect, it } from 'vitest'
import { formatGirth, parseToMm } from '../girth'

describe('girth helpers', () => {
  it('parses cm and inches to mm', () => {
    expect(parseToMm('94.0', true)).toBe(940)
    expect(parseToMm('94,5', true)).toBe(945)
    expect(parseToMm('37.0', false)).toBe(940) // 939.8 -> 940
  })

  it('rejects garbage and out-of-range values', () => {
    expect(parseToMm('', true)).toBeNull()
    expect(parseToMm('abc', true)).toBeNull()
    expect(parseToMm('2', true)).toBeNull()
    expect(parseToMm('400', true)).toBeNull()
  })

  it('formats one decimal in both units', () => {
    expect(formatGirth(940, true)).toBe('94.0 cm')
    expect(formatGirth(940, false)).toBe('37.0 in')
  })
})
