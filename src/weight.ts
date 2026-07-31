// Body-weight unit helpers. Storage is ALWAYS integer grams; kg/lb is display-only.
export const GRAMS_PER_LB = 453.59237

export const kgToGrams = (kg: number): number => Math.round(kg * 1000)
export const lbToGrams = (lb: number): number => Math.round(lb * GRAMS_PER_LB)
export const gramsToKg = (g: number): number => g / 1000
export const gramsToLb = (g: number): number => g / GRAMS_PER_LB

/** "84.6 kg" / "186.5 lb" — one decimal. */
export function formatWeight(grams: number, useKg: boolean): string {
  const value = useKg ? gramsToKg(grams) : gramsToLb(grams)
  return `${value.toFixed(1)} ${useKg ? 'kg' : 'lb'}`
}

/** Parses user input in the selected unit to grams; null when invalid or non-positive. */
export function parseToGrams(input: string | number, useKg: boolean): number | null {
  const trimmed = String(input).trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) return null
  return useKg ? kgToGrams(value) : lbToGrams(value)
}
