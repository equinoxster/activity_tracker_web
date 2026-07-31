import { describe, expect, it } from 'vitest'
import { kgToGrams, lbToGrams, gramsToKg, gramsToLb, formatWeight, parseToGrams } from '../weight'

describe('weight helpers', () => {
  it('converts kg and lb to grams', () => {
    expect(kgToGrams(84.6)).toBe(84600)
    expect(lbToGrams(186.5)).toBe(84595)
  })

  it('converts grams back to display units', () => {
    expect(gramsToKg(84600)).toBeCloseTo(84.6, 9)
    expect(gramsToLb(84595)).toBeCloseTo(186.5, 3)
  })

  it('formats one decimal with unit', () => {
    expect(formatWeight(84600, true)).toBe('84.6 kg')
    expect(formatWeight(84595, false)).toBe('186.5 lb')
  })

  it('parses dot and comma input to grams', () => {
    expect(parseToGrams('84.6', true)).toBe(84600)
    expect(parseToGrams(' 84,6 ', true)).toBe(84600)
    expect(parseToGrams('186.5', false)).toBe(84595)
  })

  it('rejects invalid and non-positive input', () => {
    expect(parseToGrams('abc', true)).toBeNull()
    expect(parseToGrams('', true)).toBeNull()
    expect(parseToGrams('0', true)).toBeNull()
    expect(parseToGrams('-5', false)).toBeNull()
  })
})
