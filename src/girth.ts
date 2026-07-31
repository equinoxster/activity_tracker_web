// Circumference unit helpers. Storage is ALWAYS integer millimetres; cm vs
// inches follows the height display unit.
export const MM_PER_INCH = 25.4
export const MIN_MM = 100
export const MAX_MM = 3000

/** Parses user input in the selected unit to mm; null when invalid or out of range. */
export function parseToMm(input: string, useCm: boolean): number | null {
  const trimmed = String(input).trim().replace(',', '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) return null
  const mm = Math.round(useCm ? value * 10 : value * MM_PER_INCH)
  return mm >= MIN_MM && mm <= MAX_MM ? mm : null
}

export function displayValue(mm: number, useCm: boolean): number {
  return useCm ? mm / 10 : mm / MM_PER_INCH
}

/** "94.0 cm" / "37.0 in" — one decimal. */
export function formatGirth(mm: number, useCm: boolean): string {
  return `${displayValue(mm, useCm).toFixed(1)} ${useCm ? 'cm' : 'in'}`
}
