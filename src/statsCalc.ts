// Pure statistics computations for the expanded Stats/Measurements pages.
// Formulas follow docs/superpowers/specs/2026-07-12-stats-expansion-design.md
// (normative) and mirror the Android app's StatsMath. Parameter types are
// structural subsets of the contract types so the helpers stay testable with
// lean fixtures (same convention as charts.ts).

import type { ActiveRegime, Move } from './types'
import { weekLabel, weekStart, weeksBetween } from './charts'

export { weeklyVolume as weeklyTonnage } from './charts'

const DAY_MS = 86400000

// ── shared structural inputs ────────────────────────────────────────────────

export interface StatsEntry {
  move_name: string
  reps: number
  weight: number
  performed_at?: number
  side?: string
}

export interface StatsWorkout {
  started_at: number
  duration_seconds?: number
  entries: StatsEntry[]
}

type MoveMeta = Pick<Move, 'name' | 'movement_group' | 'movement_height'>

const inRange = (startedAt: number, sinceMs: number | null): boolean => !sinceMs || startedAt >= sinceMs

/** Eligible for e1RM per the spec: a weighted set of 1–15 reps. */
const e1rmEligible = (e: StatsEntry): boolean => e.weight > 0 && e.reps >= 1 && e.reps <= 15

// ── strength ────────────────────────────────────────────────────────────────

/** Epley estimated 1RM: weight × (1 + reps/30). */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

/** Best e1RM per session for one move, ascending [startedAt, e1rm] pairs. */
export function e1rmTrend(workouts: StatsWorkout[], moveName: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (const w of workouts) {
    const values = w.entries
      .filter((e) => e.move_name === moveName && e1rmEligible(e))
      .map((e) => epley(e.weight, e.reps))
    if (values.length) points.push([w.started_at, Math.max(...values)])
  }
  points.sort((a, b) => a[0] - b[0])
  return points
}

export interface MovePRs {
  maxWeight: number
  bestE1rm: number | null
  maxSessionVolume: number
}

/** All-time PRs for one move; null when it has no weighted sets. */
export function movePRs(workouts: StatsWorkout[], moveName: string): MovePRs | null {
  let maxWeight = 0
  let bestE1rm: number | null = null
  let maxSessionVolume = 0
  for (const w of workouts) {
    let sessionVolume = 0
    for (const e of w.entries) {
      if (e.move_name !== moveName || e.weight <= 0) continue
      sessionVolume += e.reps * e.weight
      if (e.weight > maxWeight) maxWeight = e.weight
      if (e1rmEligible(e)) {
        const v = epley(e.weight, e.reps)
        if (bestE1rm === null || v > bestE1rm) bestE1rm = v
      }
    }
    if (sessionVolume > maxSessionVolume) maxSessionVolume = sessionVolume
  }
  if (maxWeight <= 0) return null
  return { maxWeight, bestE1rm, maxSessionVolume }
}

export interface PrEvent {
  date: number
  moveName: string
  kind: 'weight' | 'e1rm'
  value: number
}

/**
 * Newest-first PR events: one per session/move/kind whenever the per-move
 * all-time max weight or e1RM is newly set (the first entry counts).
 */
export function recentPRs(workouts: StatsWorkout[], limit = 10): PrEvent[] {
  return allPrEvents(workouts).sort((a, b) => b.date - a.date).slice(0, limit)
}

function allPrEvents(workouts: StatsWorkout[]): PrEvent[] {
  const events: PrEvent[] = []
  const maxWeight = new Map<string, number>()
  const maxE1rm = new Map<string, number>()
  const chronological = [...workouts].sort((a, b) => a.started_at - b.started_at)
  for (const w of chronological) {
    const sessionWeight = new Map<string, number>()
    const sessionE1rm = new Map<string, number>()
    for (const e of w.entries) {
      if (e.weight > 0 && e.weight > (sessionWeight.get(e.move_name) ?? 0)) {
        sessionWeight.set(e.move_name, e.weight)
      }
      if (e1rmEligible(e)) {
        const v = epley(e.weight, e.reps)
        if (v > (sessionE1rm.get(e.move_name) ?? 0)) sessionE1rm.set(e.move_name, v)
      }
    }
    for (const [move, value] of sessionWeight) {
      const prev = maxWeight.get(move)
      // The first-ever max is a baseline, not a PR (matches the app's StatsAggregator).
      if (prev !== undefined && value > prev) {
        events.push({ date: w.started_at, moveName: move, kind: 'weight', value })
      }
      if (prev === undefined || value > prev) maxWeight.set(move, value)
    }
    for (const [move, value] of sessionE1rm) {
      const prev = maxE1rm.get(move)
      if (prev !== undefined && value > prev) {
        events.push({ date: w.started_at, moveName: move, kind: 'e1rm', value })
      }
      if (prev === undefined || value > prev) maxE1rm.set(move, value)
    }
  }
  return events
}

function tonnageBy(
  workouts: StatsWorkout[],
  moves: MoveMeta[],
  sinceMs: number | null,
  keyOf: (m: MoveMeta | undefined) => string,
  buckets: string[],
): Record<string, number> {
  const byName = new Map(moves.map((m) => [m.name.toLowerCase(), m]))
  const out: Record<string, number> = Object.fromEntries(buckets.map((b) => [b, 0]))
  for (const w of workouts) {
    if (!inRange(w.started_at, sinceMs)) continue
    for (const e of w.entries) {
      if (e.weight <= 0 || e.reps <= 0) continue
      const key = keyOf(byName.get(e.move_name.toLowerCase()))
      out[key] = (out[key] || 0) + e.reps * e.weight
    }
  }
  return out
}

/** Tonnage split by movement group; unknown moves default to LEGS (groupComposition idiom). */
export function tonnageByGroup(
  workouts: StatsWorkout[],
  moves: MoveMeta[],
  sinceMs: number | null,
): Record<string, number> {
  return tonnageBy(workouts, moves, sinceMs, (m) => m?.movement_group || 'LEGS', ['PUSH', 'PULL', 'LEGS'])
}

/** Tonnage split by movement height; unknown moves default to LOWER (move-editor default). */
export function tonnageByHeight(
  workouts: StatsWorkout[],
  moves: MoveMeta[],
  sinceMs: number | null,
): Record<string, number> {
  return tonnageBy(workouts, moves, sinceMs, (m) => m?.movement_height || 'LOWER', ['UPPER', 'LOWER', 'CORE'])
}

/** pushTonnage / pullTonnage in range; null when there is no pull tonnage. */
export function pushPullRatio(workouts: StatsWorkout[], moves: MoveMeta[], sinceMs: number | null): number | null {
  const groups = tonnageByGroup(workouts, moves, sinceMs)
  const pull = groups.PULL || 0
  if (pull <= 0) return null
  return (groups.PUSH || 0) / pull
}

export interface RepRanges {
  strength: number
  hypertrophy: number
  endurance: number
}

/** Weighted-set counts in the 1–5 / 6–12 / 13+ rep ranges. */
export function repRangeDistribution(workouts: StatsWorkout[], sinceMs: number | null): RepRanges {
  const out: RepRanges = { strength: 0, hypertrophy: 0, endurance: 0 }
  for (const w of workouts) {
    if (!inRange(w.started_at, sinceMs)) continue
    for (const e of w.entries) {
      if (e.weight <= 0 || e.reps < 1) continue
      if (e.reps <= 5) out.strength++
      else if (e.reps <= 12) out.hypertrophy++
      else out.endurance++
    }
  }
  return out
}

export interface RestStats {
  medianRestS: number | null
  setsPerHour: number | null
}

/**
 * Median rest between consecutive sets (gaps ≥ 15 min ignored) and average
 * sets-per-hour across workouts in range.
 */
export function restStats(workouts: StatsWorkout[], sinceMs: number | null): RestStats {
  const gaps: number[] = []
  const setRates: number[] = []
  for (const w of workouts) {
    if (!inRange(w.started_at, sinceMs)) continue
    const times = w.entries
      .map((e) => e.performed_at)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0)
      .sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      const gapS = (times[i] - times[i - 1]) / 1000
      if (gapS < 900) gaps.push(gapS)
    }
    const durationS = w.duration_seconds ?? 0
    if (durationS > 0 && w.entries.length) setRates.push(w.entries.length / (durationS / 3600))
  }
  return {
    medianRestS: median(gaps),
    setsPerHour: setRates.length ? setRates.reduce((a, b) => a + b, 0) / setRates.length : null,
  }
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Per-session unilateral imbalance for one move:
 * (bestLeft − bestRight) / max(bestLeft, bestRight), ascending pairs.
 */
export function asymmetryTrend(workouts: StatsWorkout[], moveName: string): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (const w of workouts) {
    let bestLeft = 0
    let bestRight = 0
    for (const e of w.entries) {
      if (e.move_name !== moveName || e.weight <= 0) continue
      if (e.side === 'LEFT' && e.weight > bestLeft) bestLeft = e.weight
      if (e.side === 'RIGHT' && e.weight > bestRight) bestRight = e.weight
    }
    if (bestLeft > 0 && bestRight > 0) {
      points.push([w.started_at, (bestLeft - bestRight) / Math.max(bestLeft, bestRight)])
    }
  }
  points.sort((a, b) => a[0] - b[0])
  return points
}

// ── habits (streaks, heatmap, histograms) ───────────────────────────────────

export interface SessionTime {
  started_at: number
}

/** Local calendar date key (yyyy-mm-dd) of a timestamp. */
export function localIsoDate(ms: number): string {
  const d = new Date(ms)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

const startOfLocalDay = (ms: number): number => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const addLocalDays = (ms: number, days: number): number => {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** Whole calendar days from [fromMs]'s local date to [toMs]'s local date. */
const localDayDiff = (toMs: number, fromMs: number): number =>
  Math.round((Date.parse(localIsoDate(toMs)) - Date.parse(localIsoDate(fromMs))) / DAY_MS)

/** Sessions of any type per local calendar day. */
export function activeDayCounts(
  workouts: SessionTime[],
  hiitWorkouts: SessionTime[],
  runWorkouts: SessionTime[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of [...workouts, ...hiitWorkouts, ...runWorkouts]) {
    const key = localIsoDate(s.started_at)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

/** Days with at least one finished session of any type. */
export function activeDays(
  workouts: SessionTime[],
  hiitWorkouts: SessionTime[],
  runWorkouts: SessionTime[],
): Set<string> {
  return new Set(activeDayCounts(workouts, hiitWorkouts, runWorkouts).keys())
}

export interface Streaks {
  current: number
  longest: number
}

/** Consecutive-day streaks; a streak ending yesterday still counts as current. */
export function streaks(days: ReadonlySet<string>, todayIso: string): Streaks {
  if (!days.size) return { current: 0, longest: 0 }
  const sorted = [...days].sort().map((d) => Date.parse(d))
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] - sorted[i - 1] === DAY_MS ? run + 1 : 1
    if (run > longest) longest = run
  }
  const todayMs = Date.parse(todayIso)
  const last = sorted[sorted.length - 1]
  let anchor: number
  if (days.has(todayIso)) anchor = todayMs
  else if (last === todayMs - DAY_MS) anchor = last
  else return { current: 0, longest }
  const lookup = new Set(sorted)
  let current = 1
  let cursor = anchor - DAY_MS
  while (lookup.has(cursor)) {
    current++
    cursor -= DAY_MS
  }
  return { current, longest }
}

export interface HeatmapCell {
  date: string
  count: number
}

/** Mon–Sun week columns (oldest first) ending in the week of [nowMs]. */
export function heatmapWeeks(
  dayCounts: ReadonlyMap<string, number>,
  nowMs: number,
  weeks = 26,
): HeatmapCell[][] {
  const currentWeek = weekStart(nowMs)
  const grid: HeatmapCell[][] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = addLocalDays(currentWeek, -7 * w)
    const cells: HeatmapCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = localIsoDate(addLocalDays(monday, i))
      cells.push({ date, count: dayCounts.get(date) || 0 })
    }
    grid.push(cells)
  }
  return grid
}

/** Session counts per local weekday, Monday first. */
export function weekdayHistogram(
  workouts: SessionTime[],
  hiitWorkouts: SessionTime[],
  runWorkouts: SessionTime[],
): number[] {
  const out = new Array<number>(7).fill(0)
  for (const s of [...workouts, ...hiitWorkouts, ...runWorkouts]) {
    out[(new Date(s.started_at).getDay() + 6) % 7]++
  }
  return out
}

/** Session counts per local start hour (0–23). */
export function startHourHistogram(
  workouts: SessionTime[],
  hiitWorkouts: SessionTime[],
  runWorkouts: SessionTime[],
): number[] {
  const out = new Array<number>(24).fill(0)
  for (const s of [...workouts, ...hiitWorkouts, ...runWorkouts]) {
    out[new Date(s.started_at).getHours()]++
  }
  return out
}

// ── neglect ─────────────────────────────────────────────────────────────────

export interface GroupNeglect {
  group: string
  daysSince: number | null
}

/** Days since each movement group was last trained (null = never). */
export function neglectedGroups(
  workouts: StatsWorkout[],
  moves: MoveMeta[],
  nowMs: number,
): GroupNeglect[] {
  const groupByMove = new Map(moves.map((m) => [m.name.toLowerCase(), m.movement_group || 'LEGS']))
  const lastByGroup = new Map<string, number>()
  for (const w of workouts) {
    for (const e of w.entries) {
      const group = groupByMove.get(e.move_name.toLowerCase()) || 'LEGS'
      if (w.started_at > (lastByGroup.get(group) ?? 0)) lastByGroup.set(group, w.started_at)
    }
  }
  return ['PUSH', 'PULL', 'LEGS'].map((group) => {
    const last = lastByGroup.get(group)
    return { group, daysSince: last === undefined ? null : localDayDiff(nowMs, last) }
  })
}

export interface MoveNeglect {
  name: string
  daysSince: number | null
}

/**
 * Enabled moves with no logged set in [staleDays]+ days, most stale first
 * (never-trained moves rank as most stale), capped at 10.
 */
export function neglectedMoves(
  workouts: StatsWorkout[],
  moves: Array<MoveMeta & Pick<Move, 'is_enabled'>>,
  nowMs: number,
  staleDays = 30,
): MoveNeglect[] {
  const lastByMove = new Map<string, number>()
  for (const w of workouts) {
    for (const e of w.entries) {
      const key = e.move_name.toLowerCase()
      if (w.started_at > (lastByMove.get(key) ?? 0)) lastByMove.set(key, w.started_at)
    }
  }
  return moves
    .filter((m) => m.is_enabled)
    .map((m) => {
      const last = lastByMove.get(m.name.toLowerCase())
      return { name: m.name, daysSince: last === undefined ? null : localDayDiff(nowMs, last) }
    })
    .filter((m) => m.daysSince === null || m.daysSince >= staleDays)
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))
    .slice(0, 10)
}

// ── regime adherence ────────────────────────────────────────────────────────

export interface RegimeAdherence {
  fulfilled: number
  planned: number
  percent: number | null
  avgSlipDays: number | null
  completedLoops: number
}

const asFinite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * Adherence from the client-owned active-regime document. The document shape
 * is only loosely known here, so every field is parsed defensively; null is
 * returned whenever the required fields are absent or malformed.
 *
 * Planned-so-far counts nominal due dates (assuming on-time completion from
 * started_at) that fall on or before nowMs, capped at total_loops × slots.
 */
export function regimeAdherence(regime: ActiveRegime | null | undefined, nowMs: number): RegimeAdherence | null {
  if (!regime || typeof regime !== 'object') return null
  const startedAt = asFinite(regime['started_at'])
  const totalLoops = asFinite(regime['total_loops'])
  const loopGapDays = asFinite(regime['loop_gap_days'])
  const slotsRaw = regime['slots']
  if (startedAt === null || totalLoops === null || totalLoops < 1 || loopGapDays === null) return null
  if (!Array.isArray(slotsRaw)) return null
  const slots = slotsRaw
    .map((s: unknown) => {
      if (!s || typeof s !== 'object') return null
      const rec = s as Record<string, unknown>
      const slotIndex = asFinite(rec['slot_index'])
      const gapDays = asFinite(rec['gap_days'])
      return slotIndex === null || gapDays === null ? null : { slotIndex, gapDays }
    })
    .filter((s): s is { slotIndex: number; gapDays: number } => s !== null)
    .sort((a, b) => a.slotIndex - b.slotIndex)
  if (!slots.length) return null

  const logRaw = regime['log']
  const log = (Array.isArray(logRaw) ? logRaw : []).filter(
    (l): l is Record<string, unknown> => !!l && typeof l === 'object',
  )

  // Planned slots so far on the nominal schedule.
  const slotCount = slots.length
  const total = totalLoops * slotCount
  let planned = 0
  let due = startOfLocalDay(startedAt)
  let loop = 1
  let idx = 0
  while (planned < total && due <= nowMs) {
    planned++
    if (idx < slotCount - 1) {
      idx++
      due = addLocalDays(due, slots[idx].gapDays)
    } else if (loop < totalLoops) {
      loop++
      idx = 0
      due = addLocalDays(due, loopGapDays)
    } else {
      break
    }
  }

  // Average slip over fulfilled slots: actual gap − planned gap, in days.
  const gapBySlot = new Map(slots.map((s) => [s.slotIndex, s.gapDays]))
  const fulfilledEntries = log
    .map((l) => ({
      loopNo: asFinite(l['loop_no']) ?? 1,
      slotIndex: asFinite(l['slot_index']),
      completedAt: asFinite(l['completed_at']),
    }))
    .filter((l): l is { loopNo: number; slotIndex: number; completedAt: number } =>
      l.slotIndex !== null && l.completedAt !== null)
    .sort((a, b) => a.completedAt - b.completedAt)
  const slips: number[] = []
  let prevCompleted = startedAt
  for (const entry of fulfilledEntries) {
    const plannedGap = entry.slotIndex > 0
      ? (gapBySlot.get(entry.slotIndex) ?? 0)
      : entry.loopNo > 1 ? loopGapDays : 0
    slips.push(localDayDiff(entry.completedAt, prevCompleted) - plannedGap)
    prevCompleted = entry.completedAt
  }

  const lastSlotIndex = slots[slots.length - 1].slotIndex
  const completedLoops = fulfilledEntries.filter((l) => l.slotIndex === lastSlotIndex).length
  const fulfilled = log.length
  return {
    fulfilled,
    planned,
    percent: planned > 0 ? (fulfilled / planned) * 100 : null,
    avgSlipDays: slips.length ? slips.reduce((a, b) => a + b, 0) / slips.length : null,
    completedLoops,
  }
}

// ── HIIT ────────────────────────────────────────────────────────────────────

export interface HiitSession {
  started_at: number
  duration_seconds: number
  phases?: Array<{ phase_type: string; move_name?: string | null; duration_seconds: number }>
}

/** Total HIIT minutes per week ({labels, values} like weeklyVolume). */
export function weeklyHiitMinutes(
  hiitWorkouts: HiitSession[],
  sinceMs: number | null,
  nowMs: number,
): { labels: string[]; values: number[] } {
  const filtered = hiitWorkouts.filter((w) => inRange(w.started_at, sinceMs))
  if (!filtered.length) return { labels: [], values: [] }
  const byWeek = new Map<number, number>()
  for (const w of filtered) {
    const key = weekStart(w.started_at)
    byWeek.set(key, (byWeek.get(key) || 0) + (w.duration_seconds || 0))
  }
  const first = Math.min(...byWeek.keys())
  const weeks = weeksBetween(sinceMs || first, nowMs)
  return { labels: weeks.map(weekLabel), values: weeks.map((k) => Math.round((byWeek.get(k) || 0) / 60)) }
}

/** The longest HIIT session on record. */
export function longestHiit(hiitWorkouts: HiitSession[]): { startedAt: number; durationS: number } | null {
  let best: { startedAt: number; durationS: number } | null = null
  for (const w of hiitWorkouts) {
    if (!best || w.duration_seconds > best.durationS) {
      best = { startedAt: w.started_at, durationS: w.duration_seconds }
    }
  }
  return best
}

/** WORK-phase seconds per move in range, largest first. */
export function hiitWorkSecondsPerMove(
  hiitWorkouts: HiitSession[],
  sinceMs: number | null,
): Array<{ moveName: string; workS: number }> {
  const byMove = new Map<string, number>()
  for (const w of hiitWorkouts) {
    if (!inRange(w.started_at, sinceMs)) continue
    for (const p of w.phases ?? []) {
      if (p.phase_type !== 'WORK' || !p.move_name) continue
      byMove.set(p.move_name, (byMove.get(p.move_name) || 0) + (p.duration_seconds || 0))
    }
  }
  return [...byMove.entries()]
    .map(([moveName, workS]) => ({ moveName, workS }))
    .sort((a, b) => b.workS - a.workS || a.moveName.localeCompare(b.moveName))
}

// ── runs ────────────────────────────────────────────────────────────────────

export interface RunLike {
  started_at: number
  activity_type: string
  distance_m: number
  duration_s: number
  avg_pace_s_per_km?: number | null
  splits?: Array<{ km: number; seconds: number }> | null
}

const runPace = (r: RunLike): number | null => {
  const pace = r.avg_pace_s_per_km ?? (r.distance_m > 0 ? r.duration_s / (r.distance_m / 1000) : null)
  return pace !== null && Number.isFinite(pace) && pace > 0 ? pace : null
}

/** Average pace per finished run (s/km), ascending; distance > 0 only. Null activity = all. */
export function paceTrend(runs: RunLike[], activity: string | null): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (const r of runs) {
    if (activity && r.activity_type !== activity) continue
    if (r.distance_m <= 0) continue
    const pace = runPace(r)
    if (pace !== null) points.push([r.started_at, pace])
  }
  points.sort((a, b) => a[0] - b[0])
  return points
}

/** The fastest single-km split across all runs. */
export function fastestKm(runs: RunLike[]): { seconds: number; startedAt: number } | null {
  let best: { seconds: number; startedAt: number } | null = null
  for (const r of runs) {
    for (const s of r.splits ?? []) {
      if (s.seconds > 0 && (!best || s.seconds < best.seconds)) {
        best = { seconds: s.seconds, startedAt: r.started_at }
      }
    }
  }
  return best
}

/** The longest run by entered distance. */
export function longestRun(runs: RunLike[]): { km: number; startedAt: number } | null {
  let best: RunLike | null = null
  for (const r of runs) {
    if (r.distance_m > 0 && (!best || r.distance_m > best.distance_m)) best = r
  }
  return best ? { km: +(best.distance_m / 1000).toFixed(1), startedAt: best.started_at } : null
}

/**
 * Share of runs (≥ 2 splits) whose second half was faster than the first;
 * with an odd split count the middle split is ignored.
 */
export function negativeSplitShare(runs: RunLike[]): { negative: number; eligible: number; sharePct: number | null } {
  let negative = 0
  let eligible = 0
  for (const r of runs) {
    const splits = r.splits ?? []
    if (splits.length < 2) continue
    eligible++
    const half = Math.floor(splits.length / 2)
    const firstHalf = splits.slice(0, half).reduce((a, s) => a + s.seconds, 0)
    const secondHalf = splits.slice(splits.length - half).reduce((a, s) => a + s.seconds, 0)
    if (secondHalf < firstHalf) negative++
  }
  return { negative, eligible, sharePct: eligible ? (negative / eligible) * 100 : null }
}

const ACTIVITY_ORDER: Record<string, number> = { running: 0, walking: 1, treadmill: 2 }

/** Current-year and all-time kilometres per activity. */
export function runMilestones(
  runs: RunLike[],
  nowMs: number,
): Array<{ activity: string; yearKm: number; allTimeKm: number }> {
  const year = new Date(nowMs).getFullYear()
  const byActivity = new Map<string, { yearKm: number; allTimeKm: number }>()
  for (const r of runs) {
    const key = r.activity_type || 'running'
    const row = byActivity.get(key) || { yearKm: 0, allTimeKm: 0 }
    const km = r.distance_m / 1000
    row.allTimeKm += km
    if (new Date(r.started_at).getFullYear() === year) row.yearKm += km
    byActivity.set(key, row)
  }
  return [...byActivity.entries()]
    .map(([activity, row]) => ({
      activity,
      yearKm: +row.yearKm.toFixed(1),
      allTimeKm: +row.allTimeKm.toFixed(1),
    }))
    .sort(
      (a, b) =>
        (ACTIVITY_ORDER[a.activity] ?? 3) - (ACTIVITY_ORDER[b.activity] ?? 3) ||
        a.activity.localeCompare(b.activity),
    )
}

/** Treadmill count and km against all runs in range. */
export function treadmillShare(
  runs: RunLike[],
  sinceMs: number | null,
): { count: number; totalCount: number; km: number; totalKm: number } {
  let count = 0
  let totalCount = 0
  let km = 0
  let totalKm = 0
  for (const r of runs) {
    if (!inRange(r.started_at, sinceMs)) continue
    totalCount++
    totalKm += r.distance_m / 1000
    if (r.activity_type === 'treadmill') {
      count++
      km += r.distance_m / 1000
    }
  }
  return { count, totalCount, km: +km.toFixed(1), totalKm: +totalKm.toFixed(1) }
}

export const PACE_ZONE_LABELS = ['<5:00', '5:00–6:00', '6:00–7:00', '>7:00'] as const

/** Minutes spent in each pace zone, from km-split times. */
export function paceZones(runs: RunLike[], sinceMs: number | null): Array<{ label: string; minutes: number }> {
  const minutes = [0, 0, 0, 0]
  for (const r of runs) {
    if (!inRange(r.started_at, sinceMs)) continue
    for (const s of r.splits ?? []) {
      if (s.seconds <= 0) continue
      const zone = s.seconds < 300 ? 0 : s.seconds < 360 ? 1 : s.seconds < 420 ? 2 : 3
      minutes[zone] += s.seconds / 60
    }
  }
  return PACE_ZONE_LABELS.map((label, i) => ({ label, minutes: minutes[i] }))
}

// ── body analytics ──────────────────────────────────────────────────────────

type WeightEntry = { date: string; grams: number }

const weightPoints = (weights: WeightEntry[]): Array<[number, number]> =>
  weights
    .map((b): [number, number] => [Date.parse(b.date), b.grams])
    .filter(([t]) => Number.isFinite(t))
    .sort((a, b) => a[0] - b[0])

/**
 * Trailing mean over [windowDays] at each entry date (window end-inclusive,
 * start-exclusive — mirrors StatsMath.rollingMean).
 */
export function rollingWeight(weights: WeightEntry[], windowDays = 7): Array<[number, number]> {
  const points = weightPoints(weights)
  const window = windowDays * DAY_MS
  return points.map(([end]) => {
    const inWindow = points.filter(([t]) => t > end - window && t <= end)
    return [end, inWindow.reduce((a, [, v]) => a + v, 0) / inWindow.length]
  })
}

/**
 * Least-squares slope of the weight series over the trailing [windowDays],
 * in grams per week; null when fewer than two entries fall in the window.
 */
export function weightSlopePerWeek(weights: WeightEntry[], nowMs: number, windowDays = 28): number | null {
  const cutoff = nowMs - windowDays * DAY_MS
  const recent = weightPoints(weights).filter(([t]) => t >= cutoff)
  if (recent.length < 2) return null
  const n = recent.length
  const meanX = recent.reduce((a, [t]) => a + t, 0) / n
  const meanY = recent.reduce((a, [, v]) => a + v, 0) / n
  const denom = recent.reduce((a, [t]) => a + (t - meanX) * (t - meanX), 0)
  if (denom === 0) return null
  const slopePerMs = recent.reduce((a, [t, v]) => a + (t - meanX) * (v - meanY), 0) / denom
  return slopePerMs * 7 * DAY_MS
}

/**
 * Two series indexed to 100 at the start of their common date range (no dual
 * axes); null unless both have ≥ 2 points from the overlap start onward.
 */
export function indexedPair(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): { a: Array<[number, number]>; b: Array<[number, number]> } | null {
  if (!a.length || !b.length) return null
  const overlapStart = Math.max(a[0][0], b[0][0])
  const aWindow = a.filter(([t]) => t >= overlapStart)
  const bWindow = b.filter(([t]) => t >= overlapStart)
  if (aWindow.length < 2 || bWindow.length < 2) return null
  const aBase = aWindow[0][1]
  const bBase = bWindow[0][1]
  if (aBase <= 0 || bBase <= 0) return null
  const index = (points: Array<[number, number]>, base: number): Array<[number, number]> =>
    points.map(([t, v]) => [t, (v / base) * 100])
  return { a: index(aWindow, aBase), b: index(bWindow, bBase) }
}

/** ISO-8601 week key like "2026-W28" for a yyyy-mm-dd date; null when unparseable. */
export function isoWeekKey(date: string): string | null {
  const t = Date.parse(date)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)) // shift to the ISO-week Thursday
  const isoYear = d.getUTCFullYear()
  const yearStart = Date.UTC(isoYear, 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export interface BpReading {
  date: string
  slot: string
  systolic: number
  diastolic: number
  pulse: number | null
}

export interface BpWeekRow {
  week: string
  weekStartMs: number
  amSys: number | null
  amDia: number | null
  amPulse: number | null
  pmSys: number | null
  pmDia: number | null
  pmPulse: number | null
  n: number
}

const mean = (values: number[]): number | null =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null

/** Weekly AM/PM mean systolic/diastolic (and pulse where present), newest week first. */
export function bpWeekly(readings: BpReading[]): BpWeekRow[] {
  const byWeek = new Map<string, { weekStartMs: number; rows: BpReading[] }>()
  for (const r of readings) {
    const week = isoWeekKey(r.date)
    const t = Date.parse(r.date)
    if (!week || !Number.isFinite(t)) continue
    const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS
    const bucket = byWeek.get(week) || { weekStartMs: monday, rows: [] }
    bucket.weekStartMs = Math.min(bucket.weekStartMs, monday)
    bucket.rows.push(r)
    byWeek.set(week, bucket)
  }
  return [...byWeek.entries()]
    .map(([week, { weekStartMs, rows }]): BpWeekRow => {
      const am = rows.filter((r) => r.slot === 'morning')
      const pm = rows.filter((r) => r.slot === 'evening')
      const pulses = (slot: BpReading[]) => slot.map((r) => r.pulse).filter((p): p is number => p !== null)
      return {
        week,
        weekStartMs,
        amSys: mean(am.map((r) => r.systolic)),
        amDia: mean(am.map((r) => r.diastolic)),
        amPulse: mean(pulses(am)),
        pmSys: mean(pm.map((r) => r.systolic)),
        pmDia: mean(pm.map((r) => r.diastolic)),
        pmPulse: mean(pulses(pm)),
        n: rows.length,
      }
    })
    .sort((a, b) => b.weekStartMs - a.weekStartMs)
}

/** Percent of readings with systolic < 130 AND diastolic < 85; null when empty. */
export function bpNormalShare(readings: Array<Pick<BpReading, 'systolic' | 'diastolic'>>): number | null {
  if (!readings.length) return null
  const normal = readings.filter((r) => r.systolic < 130 && r.diastolic < 85).length
  return (normal / readings.length) * 100
}

/** Per-reading pulse values in the same order as bloodPressureSeries. */
export function bpPulseSeries(readings: BpReading[]): { labels: string[]; pulse: Array<number | null> } {
  const slotOrder = (slot: string) => (slot === 'morning' ? 0 : 1)
  const rows = readings
    .filter((r) => Number.isFinite(Date.parse(r.date)))
    .sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.slot) - slotOrder(b.slot))
  return {
    labels: rows.map((r) => `${r.date} ${r.slot === 'morning' ? 'am' : 'pm'}`),
    pulse: rows.map((r) => r.pulse),
  }
}

/** BMI over the weight series (1 decimal); empty when height is unset. */
export function bmiTrend(weights: WeightEntry[], heightCm: number | null): Array<[number, number]> {
  if (!heightCm || heightCm <= 0) return []
  const meters = heightCm / 100
  return weightPoints(weights).map(([t, grams]) => [t, +(grams / 1000 / (meters * meters)).toFixed(1)])
}

// ── cross-domain ────────────────────────────────────────────────────────────

export interface WeeklyActivityMinutes {
  labels: string[]
  strength: number[]
  hiit: number[]
  run: number[]
}

/** Minutes of strength / HIIT / run activity per week (stacked series). */
export function weeklyActivityMinutes(
  workouts: Array<SessionTime & { duration_seconds: number }>,
  hiitWorkouts: Array<SessionTime & { duration_seconds: number }>,
  runWorkouts: Array<SessionTime & { duration_s: number }>,
  sinceMs: number | null,
  nowMs: number,
): WeeklyActivityMinutes {
  const sessions = [
    ...workouts.map((w) => ({ t: w.started_at, kind: 'strength' as const, s: w.duration_seconds || 0 })),
    ...hiitWorkouts.map((w) => ({ t: w.started_at, kind: 'hiit' as const, s: w.duration_seconds || 0 })),
    ...runWorkouts.map((w) => ({ t: w.started_at, kind: 'run' as const, s: w.duration_s || 0 })),
  ].filter((x) => inRange(x.t, sinceMs))
  if (!sessions.length) return { labels: [], strength: [], hiit: [], run: [] }
  const sums = { strength: new Map<number, number>(), hiit: new Map<number, number>(), run: new Map<number, number>() }
  for (const x of sessions) {
    const key = weekStart(x.t)
    sums[x.kind].set(key, (sums[x.kind].get(key) || 0) + x.s)
  }
  const first = Math.min(...sessions.map((x) => x.t))
  const weeks = weeksBetween(sinceMs || first, nowMs)
  const minutes = (m: Map<number, number>) => weeks.map((k) => Math.round((m.get(k) || 0) / 60))
  return {
    labels: weeks.map(weekLabel),
    strength: minutes(sums.strength),
    hiit: minutes(sums.hiit),
    run: minutes(sums.run),
  }
}

export interface YearNumbers {
  year: number
  strengthSessions: number
  hiitSessions: number
  runSessions: number
  totalHours: number
  tonnage: number
  runKm: number
  prCount: number
}

/** "Year in numbers" for the calendar year of [nowMs]. */
export function yearInNumbers(
  workouts: Array<StatsWorkout & { duration_seconds: number }>,
  hiitWorkouts: Array<SessionTime & { duration_seconds: number }>,
  runWorkouts: Array<SessionTime & { distance_m: number; duration_s: number; activity_type?: string }>,
  nowMs: number,
): YearNumbers {
  const year = new Date(nowMs).getFullYear()
  const inYear = (t: number) => new Date(t).getFullYear() === year
  const yearWorkouts = workouts.filter((w) => inYear(w.started_at))
  const yearHiit = hiitWorkouts.filter((w) => inYear(w.started_at))
  const yearRuns = runWorkouts.filter((w) => inYear(w.started_at))
  const totalSeconds =
    yearWorkouts.reduce((a, w) => a + (w.duration_seconds || 0), 0) +
    yearHiit.reduce((a, w) => a + (w.duration_seconds || 0), 0) +
    yearRuns.reduce((a, w) => a + (w.duration_s || 0), 0)
  const tonnage = yearWorkouts.reduce(
    (a, w) => a + w.entries.reduce((s, e) => s + e.reps * e.weight, 0),
    0,
  )
  // PRs are judged against all-time maxes, then counted within the year.
  const prCount = allPrEvents(workouts).filter((e) => inYear(e.date)).length
  return {
    year,
    strengthSessions: yearWorkouts.length,
    hiitSessions: yearHiit.length,
    runSessions: yearRuns.length,
    totalHours: +(totalSeconds / 3600).toFixed(1),
    tonnage: Math.round(tonnage),
    runKm: +yearRuns.reduce((a, w) => a + w.distance_m / 1000, 0).toFixed(1),
    prCount,
  }
}
