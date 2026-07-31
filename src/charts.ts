// Pure series computations for the statistics page. Weeks are ISO-ish local
// Monday buckets keyed by their start millis.
//
// Parameter types are structural subsets (Pick) of the contract types so the
// helpers stay testable with lean fixtures.

import type { BodyGirth, GirthKind, BloodPressure, BodyWeight, HiitWorkout, Move, RunWorkout, Workout } from './types'

const WEEK_MS = 7 * 24 * 3600 * 1000

export function weekStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  return d.getTime() - day * 24 * 3600 * 1000
}

export function weekLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function weeksBetween(fromMs: number, toMs: number): number[] {
  const weeks: number[] = []
  for (let w = weekStart(fromMs); w <= toMs; w += WEEK_MS) weeks.push(w)
  return weeks
}

function inRange(w: { started_at: number }, sinceMs: number | null): boolean {
  return !sinceMs || w.started_at >= sinceMs
}

/** Weekly total lifted volume (sum reps*weight) from strength workouts. */
export function weeklyVolume(
  workouts: Array<Pick<Workout, 'started_at'> & { entries: Array<{ reps: number; weight: number }> }>,
  sinceMs: number | null,
  nowMs: number,
): { labels: string[]; values: number[] } {
  const filtered = workouts.filter((w) => inRange(w, sinceMs))
  if (!filtered.length) return { labels: [], values: [] }
  const byWeek = new Map<number, number>()
  for (const w of filtered) {
    const key = weekStart(w.started_at)
    const vol = w.entries.reduce((sum, e) => sum + e.reps * e.weight, 0)
    byWeek.set(key, (byWeek.get(key) || 0) + vol)
  }
  const first = Math.min(...byWeek.keys())
  const weeks = weeksBetween(sinceMs || first, nowMs)
  return { labels: weeks.map(weekLabel), values: weeks.map((k) => Math.round(byWeek.get(k) || 0)) }
}

/** Per-session max weight for one move; x = session date. */
export function moveProgression(
  workouts: Array<Pick<Workout, 'started_at'> & { entries: Array<{ move_name: string; weight: number }> }>,
  moveName: string,
  sinceMs: number | null,
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (const w of workouts.filter((x) => inRange(x, sinceMs))) {
    const weights = w.entries.filter((e) => e.move_name === moveName && e.weight > 0).map((e) => e.weight)
    if (weights.length) points.push([w.started_at, Math.max(...weights)])
  }
  points.sort((a, b) => a[0] - b[0])
  return points
}

export function moveNamesInHistory(
  workouts: Array<{ entries: Array<{ move_name: string }> }>,
): string[] {
  const names = new Set<string>()
  for (const w of workouts) for (const e of w.entries) names.add(e.move_name)
  return [...names].sort()
}

/** Weekly counts of strength + HIIT sessions. */
export function weeklyFrequency(
  workouts: Array<Pick<Workout, 'started_at'>>,
  hiitWorkouts: Array<Pick<HiitWorkout, 'started_at'>>,
  sinceMs: number | null,
  nowMs: number,
): { labels: string[]; strength: number[]; hiit: number[] } {
  const all = [
    ...workouts.filter((w) => inRange(w, sinceMs)).map((w) => ({ t: w.started_at, kind: 'strength' })),
    ...hiitWorkouts.filter((w) => inRange(w, sinceMs)).map((w) => ({ t: w.started_at, kind: 'hiit' })),
  ]
  if (!all.length) return { labels: [], strength: [], hiit: [] }
  const first = Math.min(...all.map((x) => x.t))
  const weeks = weeksBetween(sinceMs || first, nowMs)
  const strength = new Map<number, number>()
  const hiit = new Map<number, number>()
  for (const x of all) {
    const key = weekStart(x.t)
    const m = x.kind === 'strength' ? strength : hiit
    m.set(key, (m.get(key) || 0) + 1)
  }
  return {
    labels: weeks.map(weekLabel),
    strength: weeks.map((k) => strength.get(k) || 0),
    hiit: weeks.map((k) => hiit.get(k) || 0),
  }
}

/** Set counts per movement group across strength history. */
export function groupComposition(
  workouts: Array<Pick<Workout, 'started_at'> & { entries: Array<{ move_name: string }> }>,
  moves: Array<Pick<Move, 'name' | 'movement_group'>>,
  sinceMs: number | null,
): Record<string, number> {
  const groupByMove = new Map(
    moves.map((m): [string, string] => [m.name.toLowerCase(), m.movement_group || 'LEGS']),
  )
  const counts: Record<string, number> = { LEGS: 0, PUSH: 0, PULL: 0 }
  for (const w of workouts.filter((x) => inRange(x, sinceMs))) {
    for (const e of w.entries) {
      const g = groupByMove.get(e.move_name.toLowerCase()) || 'LEGS'
      counts[g] = (counts[g] || 0) + 1
    }
  }
  return counts
}

/** Weekly HIIT work vs rest seconds. */
export function hiitWorkRest(
  hiitWorkouts: Array<Pick<HiitWorkout, 'started_at' | 'total_activity_seconds' | 'total_rest_seconds'>>,
  sinceMs: number | null,
  nowMs: number,
): { labels: string[]; work: number[]; rest: number[] } {
  const filtered = hiitWorkouts.filter((w) => inRange(w, sinceMs))
  if (!filtered.length) return { labels: [], work: [], rest: [] }
  const first = Math.min(...filtered.map((w) => w.started_at))
  const weeks = weeksBetween(sinceMs || first, nowMs)
  const work = new Map<number, number>()
  const rest = new Map<number, number>()
  for (const w of filtered) {
    const key = weekStart(w.started_at)
    work.set(key, (work.get(key) || 0) + (w.total_activity_seconds || 0))
    rest.set(key, (rest.get(key) || 0) + (w.total_rest_seconds || 0))
  }
  return {
    labels: weeks.map(weekLabel),
    work: weeks.map((k) => Math.round((work.get(k) || 0) / 60)),
    rest: weeks.map((k) => Math.round((rest.get(k) || 0) / 60)),
  }
}

/** Body weight over time: sorted [timestampMs, grams] pairs for a time-axis line. */
export function bodyWeightSeries(
  bodyWeights: Array<Pick<BodyWeight, 'date' | 'grams'>>,
  sinceMs: number | null,
): Array<[number, number]> {
  return bodyWeights
    .map((b): [number, number] => [Date.parse(b.date), b.grams])
    .filter(([t]) => Number.isFinite(t) && (!sinceMs || t >= sinceMs))
    .sort((a, b) => a[0] - b[0])
}

/** Blood pressure over readings: date+slot ordered labels with systolic/diastolic arrays. */
/** One girth kind over time: sorted [timestampMs, mm] pairs for a time-axis line. */
export function girthSeries(girths: BodyGirth[], kind: GirthKind, sinceMs?: number): [number, number][] {
  return girths
    .filter((g) => g.kind === kind)
    .map((g): [number, number] => [Date.parse(g.date), g.mm])
    .filter(([t]) => Number.isFinite(t) && (!sinceMs || t >= sinceMs))
    .sort((a, b) => a[0] - b[0])
}

export function bloodPressureSeries(
  bloodPressures: Array<Pick<BloodPressure, 'date' | 'systolic' | 'diastolic'> & { slot: string }>,
  sinceMs: number | null,
): { labels: string[]; systolic: number[]; diastolic: number[] } {
  const slotOrder = (slot: string) => (slot === 'morning' ? 0 : 1)
  const rows = bloodPressures
    .filter((b) => {
      const t = Date.parse(b.date)
      return Number.isFinite(t) && (!sinceMs || t >= sinceMs)
    })
    .sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot))
  return {
    labels: rows.map((b) => `${b.date} ${b.slot === 'morning' ? 'am' : 'pm'}`),
    systolic: rows.map((b) => b.systolic),
    diastolic: rows.map((b) => b.diastolic),
  }
}

/** Weekly run distance (km, 1 decimal) — same {labels, values} shape as weeklyVolume. */
export function weeklyRunDistance(
  runWorkouts: Array<Pick<RunWorkout, 'started_at' | 'distance_m'>>,
  sinceMs: number | null,
  nowMs: number,
): { labels: string[]; values: number[] } {
  const filtered = runWorkouts.filter((w) => inRange(w, sinceMs))
  if (!filtered.length) return { labels: [], values: [] }
  const byWeek = new Map<number, number>()
  for (const w of filtered) {
    const key = weekStart(w.started_at)
    byWeek.set(key, (byWeek.get(key) || 0) + w.distance_m / 1000)
  }
  const first = Math.min(...byWeek.keys())
  const weeks = weeksBetween(sinceMs || first, nowMs)
  return { labels: weeks.map(weekLabel), values: weeks.map((k) => +(byWeek.get(k) || 0).toFixed(1)) }
}

/** Per-activity totals (running/walking/treadmill order). distanceKm sums entered distances only. */
export function activityBreakdown(
  runWorkouts: Array<Pick<RunWorkout, 'started_at' | 'activity_type' | 'distance_m' | 'duration_s'>>,
  sinceMs: number | null,
): Array<{ activity: string; count: number; distanceKm: number; durationS: number }> {
  const order: Record<string, number> = { running: 0, walking: 1, treadmill: 2 }
  const byActivity = new Map<string, { activity: string; count: number; distanceKm: number; durationS: number }>()
  for (const w of runWorkouts.filter((w) => inRange(w, sinceMs))) {
    const key = w.activity_type || 'running'
    const row = byActivity.get(key) || { activity: key, count: 0, distanceKm: 0, durationS: 0 }
    row.count += 1
    row.distanceKm = +(row.distanceKm + w.distance_m / 1000).toFixed(1)
    row.durationS += w.duration_s || 0
    byActivity.set(key, row)
  }
  return [...byActivity.values()].sort(
    (a, b) => (order[a.activity] ?? 3) - (order[b.activity] ?? 3) || a.activity.localeCompare(b.activity),
  )
}

/** Attempts for a route tag (case-insensitive), ascending by start time. */
export function routeAttempts<T extends Pick<RunWorkout, 'started_at' | 'route_tag'>>(
  runWorkouts: T[],
  tag: string,
): T[] {
  const key = String(tag || '').trim().toLowerCase()
  if (!key) return []
  return runWorkouts
    .filter((w) => String(w.route_tag || '').trim().toLowerCase() === key)
    .sort((a, b) => a.started_at - b.started_at)
}

/** Distinct route tags, case-insensitively deduped, first spelling kept, sorted. */
export function routeTags(runWorkouts: Array<Pick<RunWorkout, 'route_tag'>>): string[] {
  const seen = new Map<string, string>()
  for (const w of runWorkouts) {
    const tag = String(w.route_tag || '').trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (!seen.has(key)) seen.set(key, tag)
  }
  return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}
