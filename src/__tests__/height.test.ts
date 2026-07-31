import { describe, expect, it } from 'vitest'
import { bmi, bmiCategory, cmToFeetInches, feetInchesToCm, formatHeight } from '../height'

describe('height helpers', () => {
  it('converts cm to feet/inches with rounding', () => {
    expect(cmToFeetInches(178)).toEqual({ feet: 5, inches: 10 })
    expect(cmToFeetInches(183)).toEqual({ feet: 6, inches: 0 }) // 72.05 in -> 72
  })

  it('converts feet/inches to cm', () => {
    expect(feetInchesToCm(5, 10)).toBe(178)
    expect(feetInchesToCm(6, 0)).toBe(183)
  })

  it('formats in both units', () => {
    expect(formatHeight(178, true)).toBe('178 cm')
    expect(formatHeight(178, false)).toBe('5 ft 10 in')
  })

  it('computes BMI and categories', () => {
    expect(bmi(83000, 178)).toBeCloseTo(26.2, 1)
    expect(bmiCategory(18.4)).toBe('Underweight')
    expect(bmiCategory(18.5)).toBe('Normal')
    expect(bmiCategory(25)).toBe('Overweight')
    expect(bmiCategory(30)).toBe('Obese')
  })
})
