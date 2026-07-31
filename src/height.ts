// Height unit helpers + BMI. Storage is ALWAYS integer cm; cm vs ft/in is display-only.
export const CM_PER_INCH = 2.54

/** { feet, inches } from cm, rounding to the nearest whole inch. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH)
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 }
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH)
}

/** "178 cm" / "5 ft 10 in". */
export function formatHeight(cm: number, useCm: boolean): string {
  if (useCm) return `${cm} cm`
  const { feet, inches } = cmToFeetInches(cm)
  return `${feet} ft ${inches} in`
}

/** BMI from stored units (grams, cm). */
export function bmi(weightGrams: number, heightCm: number): number {
  const meters = heightCm / 100
  return weightGrams / 1000 / (meters * meters)
}

export function bmiCategory(value: number): string {
  if (value < 18.5) return 'Underweight'
  if (value < 25) return 'Normal'
  if (value < 30) return 'Overweight'
  return 'Obese'
}
