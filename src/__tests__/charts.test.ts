import { describe, expect, it } from 'vitest'
import {
  weeklyRunDistance,
  routeAttempts,
  routeTags,
  weekStart,
  bloodPressureSeries,
  girthSeries,
  activityBreakdown,
} from '../charts'

const run = (startedAt: number, distanceM: number, tag = '') => ({
  started_at: startedAt,
  distance_m: distanceM,
  duration_s: 1800,
  route_tag: tag,
})

describe('run chart helpers', () => {
  it('buckets weekly distance in km with one decimal', () => {
    const monday = weekStart(Date.parse('2026-07-08T12:00:00'))
    const runs = [run(monday + 1000, 5210), run(monday + 86400000, 3100)]
    const { labels, values } = weeklyRunDistance(runs, monday, monday + 2 * 86400000)
    expect(labels.length).toBe(1)
    expect(values[0]).toBeCloseTo(8.3, 5)
  })

  it('returns empty series without runs', () => {
    expect(weeklyRunDistance([], null, Date.now())).toEqual({ labels: [], values: [] })
  })

  it('filters route attempts case-insensitively and sorts ascending', () => {
    const runs = [run(3000, 5000, 'Lake Loop'), run(1000, 5000, 'lake loop'), run(2000, 5000, 'other')]
    const attempts = routeAttempts(runs, 'LAKE LOOP')
    expect(attempts.map((a) => a.started_at)).toEqual([1000, 3000])
  })

  it('dedupes route tags keeping the first spelling', () => {
    const runs = [run(1, 1, 'Lake Loop'), run(2, 1, 'lake loop'), run(3, 1, 'commute'), run(4, 1, '')]
    expect(routeTags(runs)).toEqual(['commute', 'Lake Loop'])
  })
})

describe('bloodPressureSeries', () => {
  const readings = [
    { date: '2026-07-12', slot: 'evening', systolic: 125, diastolic: 81, pulse: 70 },
    { date: '2026-07-12', slot: 'morning', systolic: 128, diastolic: 82, pulse: 65 },
    { date: '2026-07-11', slot: 'evening', systolic: 131, diastolic: 86, pulse: null },
    { date: '2020-01-01', slot: 'morning', systolic: 140, diastolic: 90, pulse: null },
  ]

  it('orders by date then morning-before-evening', () => {
    const s = bloodPressureSeries(readings, 0)
    expect(s.labels).toEqual(['2020-01-01 am', '2026-07-11 pm', '2026-07-12 am', '2026-07-12 pm'])
    expect(s.systolic).toEqual([140, 131, 128, 125])
    expect(s.diastolic).toEqual([90, 86, 82, 81])
  })

  it('filters readings older than sinceMs', () => {
    const s = bloodPressureSeries(readings, Date.parse('2026-07-12'))
    expect(s.labels).toEqual(['2026-07-12 am', '2026-07-12 pm'])
  })
})

describe('activityBreakdown', () => {
  const runs = [
    { started_at: 1000, activity_type: 'running', distance_m: 5000, duration_s: 1500 },
    { started_at: 2000, activity_type: 'running', distance_m: 4000, duration_s: 1300 },
    { started_at: 3000, activity_type: 'treadmill', distance_m: 0, duration_s: 1800 },
    { started_at: 4000, activity_type: 'treadmill', distance_m: 3000, duration_s: 1000 },
    { started_at: 5000, activity_type: 'walking', distance_m: 2000, duration_s: 1600 },
  ]

  it('groups by activity in running/walking/treadmill order', () => {
    const rows = activityBreakdown(runs, 0)
    expect(rows.map((r) => r.activity)).toEqual(['running', 'walking', 'treadmill'])
    expect(rows[0]).toEqual({ activity: 'running', count: 2, distanceKm: 9, durationS: 2800 })
    expect(rows[2]).toEqual({ activity: 'treadmill', count: 2, distanceKm: 3, durationS: 2800 })
  })

  it('respects sinceMs', () => {
    const rows = activityBreakdown(runs, 4500)
    expect(rows).toEqual([{ activity: 'walking', count: 1, distanceKm: 2, durationS: 1600 }])
  })
})

describe('girthSeries', () => {
  const girths = [
    { date: '2026-07-12', kind: 'chest' as const, mm: 1010, updated_at: 1 },
    { date: '2026-07-12', kind: 'waist' as const, mm: 940, updated_at: 1 },
    { date: '2026-07-10', kind: 'waist' as const, mm: 950, updated_at: 1 },
  ]

  it('filters by kind and sorts by date', () => {
    expect(girthSeries(girths, 'waist')).toEqual([
      [Date.parse('2026-07-10'), 950],
      [Date.parse('2026-07-12'), 940],
    ])
    expect(girthSeries(girths, 'chest')).toHaveLength(1)
  })

  it('respects sinceMs', () => {
    expect(girthSeries(girths, 'waist', Date.parse('2026-07-11'))).toHaveLength(1)
  })
})
