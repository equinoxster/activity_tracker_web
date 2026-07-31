import { describe, expect, it } from 'vitest'
import {
  epley,
  e1rmTrend,
  movePRs,
  recentPRs,
  weeklyTonnage,
  tonnageByGroup,
  tonnageByHeight,
  pushPullRatio,
  repRangeDistribution,
  restStats,
  asymmetryTrend,
  localIsoDate,
  activeDayCounts,
  activeDays,
  streaks,
  heatmapWeeks,
  weekdayHistogram,
  startHourHistogram,
  neglectedGroups,
  neglectedMoves,
  regimeAdherence,
  weeklyHiitMinutes,
  longestHiit,
  hiitWorkSecondsPerMove,
  paceTrend,
  fastestKm,
  longestRun,
  negativeSplitShare,
  runMilestones,
  treadmillShare,
  paceZones,
  rollingWeight,
  weightSlopePerWeek,
  indexedPair,
  isoWeekKey,
  bpWeekly,
  bpNormalShare,
  bpPulseSeries,
  bmiTrend,
  weeklyActivityMinutes,
  yearInNumbers,
} from '../statsCalc'

const DAY = 86400000

// Local-noon anchor keeps calendar-day math stable in any test timezone.
const day0 = Date.parse('2026-07-01T12:00:00')
const at = (days: number) => day0 + days * DAY

interface EntrySpec {
  move_name?: string
  reps?: number
  weight?: number
  performed_at?: number
  side?: string
}

const workout = (startedAt: number, entries: EntrySpec[], durationS = 3600) => ({
  started_at: startedAt,
  duration_seconds: durationS,
  entries: entries.map((e, i) => ({
    move_name: 'Squat',
    reps: 5,
    weight: 100,
    performed_at: startedAt + i * 60000,
    side: 'BOTH',
    ...e,
  })),
})

describe('epley', () => {
  it('matches the spec formula weight * (1 + reps/30)', () => {
    expect(epley(100, 10)).toBeCloseTo(133.3333, 3)
    expect(epley(80, 1)).toBeCloseTo(82.6667, 3)
  })
})

describe('e1rmTrend', () => {
  it('takes the best e1RM per session over eligible sets only', () => {
    const w1 = workout(at(0), [
      { reps: 5, weight: 100 }, // 116.67
      { reps: 3, weight: 110 }, // 121
    ])
    const w2 = workout(at(2), [
      { reps: 20, weight: 100 }, // reps > 15 → excluded
      { reps: 5, weight: 0 }, // weight 0 → excluded
      { reps: 5, weight: 105 }, // 122.5
    ])
    const points = e1rmTrend([w2, w1], 'Squat')
    expect(points.length).toBe(2)
    expect(points[0][0]).toBe(at(0))
    expect(points[0][1]).toBeCloseTo(121, 3)
    expect(points[1][1]).toBeCloseTo(122.5, 3)
  })

  it('returns empty for unknown moves and empty history', () => {
    expect(e1rmTrend([], 'Squat')).toEqual([])
    expect(e1rmTrend([workout(at(0), [{}])], 'Bench')).toEqual([])
  })

  it('skips sessions with no eligible set', () => {
    const w = workout(at(0), [{ reps: 30, weight: 100 }])
    expect(e1rmTrend([w], 'Squat')).toEqual([])
  })
})

describe('movePRs', () => {
  it('reports max weight, best e1RM and max session volume', () => {
    const w1 = workout(at(0), [
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
    ]) // session volume 1000
    const w2 = workout(at(1), [
      { reps: 3, weight: 120 }, // e1rm 132, top weight
      { reps: 20, weight: 60 }, // ineligible for e1rm, still volume
    ]) // session volume 1560
    const prs = movePRs([w1, w2], 'Squat')
    expect(prs).not.toBeNull()
    expect(prs!.maxWeight).toBe(120)
    expect(prs!.bestE1rm).toBeCloseTo(132, 3)
    expect(prs!.maxSessionVolume).toBeCloseTo(1560, 3)
  })

  it('returns null when the move has no weighted sets', () => {
    expect(movePRs([], 'Squat')).toBeNull()
    expect(movePRs([workout(at(0), [{ weight: 0 }])], 'Squat')).toBeNull()
  })
})

describe('recentPRs', () => {
  it('emits newest-first events; the first-ever max is a baseline, not a PR', () => {
    const w1 = workout(at(0), [{ reps: 5, weight: 100 }]) // baseline: no events
    const w2 = workout(at(1), [{ reps: 5, weight: 100 }]) // tie: nothing
    const w3 = workout(at(2), [{ reps: 3, weight: 105 }]) // weight PR only (e1rm 115.5 < 116.67)
    const events = recentPRs([w3, w1, w2])
    expect(events.map((e) => [e.date, e.kind])).toEqual([[at(2), 'weight']])
    expect(events[0].moveName).toBe('Squat')
    expect(events[0].value).toBe(105)
  })

  it('caps the list at the limit', () => {
    const w1 = workout(at(0), [{ reps: 5, weight: 100 }])
    const w2 = workout(at(1), [{ reps: 5, weight: 110 }])
    const w3 = workout(at(2), [{ reps: 5, weight: 120 }])
    expect(recentPRs([w1, w2, w3], 2).length).toBe(2)
  })

  it('returns empty without history', () => {
    expect(recentPRs([])).toEqual([])
  })
})

describe('weeklyTonnage', () => {
  it('sums reps*weight per week (same series as weeklyVolume)', () => {
    const w1 = workout(at(0), [{ reps: 10, weight: 50 }]) // 500
    const w2 = workout(at(1), [{ reps: 10, weight: 60 }]) // 600
    const { values } = weeklyTonnage([w1, w2], at(0), at(1))
    expect(values.reduce((a, b) => a + b, 0)).toBe(1100)
  })
})

describe('tonnage balance', () => {
  const moves = [
    { name: 'Bench', movement_group: 'PUSH', movement_height: 'UPPER' },
    { name: 'Row', movement_group: 'PULL', movement_height: 'UPPER' },
    { name: 'Squat', movement_group: 'LEGS', movement_height: 'LOWER' },
  ]
  const workouts = [
    workout(at(0), [
      { move_name: 'Bench', reps: 10, weight: 80 }, // 800 push upper
      { move_name: 'Row', reps: 10, weight: 40 }, // 400 pull upper
      { move_name: 'Squat', reps: 10, weight: 100 }, // 1000 legs lower
      { move_name: 'Mystery', reps: 10, weight: 10 }, // 100 → LEGS / LOWER defaults
    ]),
  ]

  it('splits tonnage by movement group with LEGS default', () => {
    expect(tonnageByGroup(workouts, moves, null)).toEqual({ PUSH: 800, PULL: 400, LEGS: 1100 })
  })

  it('splits tonnage by movement height with LOWER default', () => {
    expect(tonnageByHeight(workouts, moves, null)).toEqual({ UPPER: 1200, LOWER: 1100, CORE: 0 })
  })

  it('computes push:pull ratio and returns null without pull tonnage', () => {
    expect(pushPullRatio(workouts, moves, null)).toBeCloseTo(2, 5)
    expect(pushPullRatio([], moves, null)).toBeNull()
  })

  it('honours the since filter', () => {
    expect(tonnageByGroup(workouts, moves, at(1))).toEqual({ PUSH: 0, PULL: 0, LEGS: 0 })
  })
})

describe('repRangeDistribution', () => {
  it('buckets weighted sets into 1-5 / 6-12 / 13+', () => {
    const w = workout(at(0), [
      { reps: 3 },
      { reps: 5 },
      { reps: 8 },
      { reps: 12 },
      { reps: 15 },
      { reps: 20, weight: 0 }, // unweighted → ignored
      { reps: 0 }, // no reps → ignored
    ])
    expect(repRangeDistribution([w], null)).toEqual({ strength: 2, hypertrophy: 2, endurance: 1 })
  })

  it('returns zeros when empty', () => {
    expect(repRangeDistribution([], null)).toEqual({ strength: 0, hypertrophy: 0, endurance: 0 })
  })
})

describe('restStats', () => {
  it('takes the median gap under 15 min and averages sets per hour', () => {
    const w = workout(at(0), [
      { performed_at: at(0) },
      { performed_at: at(0) + 60_000 }, // 60 s gap
      { performed_at: at(0) + 180_000 }, // 120 s gap
      { performed_at: at(0) + 1_180_000 }, // 1000 s gap → ignored
    ]) // 4 sets in 3600 s → 4 sets/h
    const stats = restStats([w], null)
    expect(stats.medianRestS).toBe(90)
    expect(stats.setsPerHour).toBeCloseTo(4, 5)
  })

  it('is null-safe on sparse data', () => {
    expect(restStats([], null)).toEqual({ medianRestS: null, setsPerHour: null })
    const single = workout(at(0), [{ performed_at: at(0) }], 0)
    expect(restStats([single], null)).toEqual({ medianRestS: null, setsPerHour: null })
  })
})

describe('asymmetryTrend', () => {
  it('computes (bestLeft - bestRight) / max per session', () => {
    const w = workout(at(0), [
      { move_name: 'Split Squat', side: 'LEFT', weight: 40 },
      { move_name: 'Split Squat', side: 'LEFT', weight: 38 },
      { move_name: 'Split Squat', side: 'RIGHT', weight: 45 },
    ])
    const points = asymmetryTrend([w], 'Split Squat')
    expect(points.length).toBe(1)
    expect(points[0][1]).toBeCloseTo((40 - 45) / 45, 5)
  })

  it('skips sessions missing one side', () => {
    const w = workout(at(0), [{ move_name: 'Split Squat', side: 'LEFT', weight: 40 }])
    expect(asymmetryTrend([w], 'Split Squat')).toEqual([])
  })
})

describe('active days & streaks', () => {
  it('counts sessions of every type per local day', () => {
    const counts = activeDayCounts(
      [{ started_at: at(0) }, { started_at: at(0) + 3600000 }],
      [{ started_at: at(0) }],
      [{ started_at: at(1) }],
    )
    expect(counts.get(localIsoDate(at(0)))).toBe(3)
    expect(counts.get(localIsoDate(at(1)))).toBe(1)
    expect(activeDays([{ started_at: at(0) }], [], [])).toEqual(new Set([localIsoDate(at(0))]))
  })

  it('computes current and longest streaks', () => {
    const days = new Set(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-10', '2026-07-11'])
    expect(streaks(days, '2026-07-11')).toEqual({ current: 2, longest: 3 })
    // streak that ended yesterday still counts as current
    expect(streaks(days, '2026-07-12')).toEqual({ current: 2, longest: 3 })
    // older gap → no current streak
    expect(streaks(days, '2026-07-14')).toEqual({ current: 0, longest: 3 })
    expect(streaks(new Set(), '2026-07-12')).toEqual({ current: 0, longest: 0 })
  })
})

describe('heatmapWeeks', () => {
  it('builds Mon-Sun week columns ending in the current week', () => {
    const now = Date.parse('2026-07-08T12:00:00') // a Wednesday
    const counts = new Map([
      ['2026-07-06', 2], // Monday of the current week
      ['2026-06-30', 1], // Tuesday of the previous week
    ])
    const grid = heatmapWeeks(counts, now, 2)
    expect(grid.length).toBe(2)
    expect(grid[0].length).toBe(7)
    expect(grid[0][0].date).toBe('2026-06-29') // Monday, previous week
    expect(grid[0][1].count).toBe(1)
    expect(grid[1][0]).toEqual({ date: '2026-07-06', count: 2 })
    expect(grid[1][6].date).toBe('2026-07-12') // Sunday of the current week
  })
})

describe('weekday and start-hour histograms', () => {
  it('buckets sessions by local weekday (Mon=0) and hour', () => {
    const wed = Date.parse('2026-07-08T06:30:00')
    const sun = Date.parse('2026-07-12T18:05:00')
    const weekdays = weekdayHistogram([{ started_at: wed }], [{ started_at: sun }], [])
    expect(weekdays[2]).toBe(1)
    expect(weekdays[6]).toBe(1)
    expect(weekdays.reduce((a, b) => a + b, 0)).toBe(2)
    const hours = startHourHistogram([{ started_at: wed }], [], [{ started_at: sun }])
    expect(hours[6]).toBe(1)
    expect(hours[18]).toBe(1)
    expect(hours.length).toBe(24)
  })
})

describe('neglect', () => {
  const moves = [
    { name: 'Bench', movement_group: 'PUSH', movement_height: 'UPPER', is_enabled: true },
    { name: 'Row', movement_group: 'PULL', movement_height: 'UPPER', is_enabled: true },
    { name: 'Squat', movement_group: 'LEGS', movement_height: 'LOWER', is_enabled: true },
    { name: 'Curl', movement_group: 'PULL', movement_height: 'UPPER', is_enabled: true },
    { name: 'Ghost', movement_group: 'PUSH', movement_height: 'UPPER', is_enabled: false },
  ]
  const workouts = [
    workout(at(0), [{ move_name: 'Squat' }]), // 40 days before "now"
    workout(at(35), [{ move_name: 'Bench' }]), // 5 days before "now"
  ]
  const now = at(40)

  it('reports days since each movement group was trained', () => {
    expect(neglectedGroups(workouts, moves, now)).toEqual([
      { group: 'PUSH', daysSince: 5 },
      { group: 'PULL', daysSince: null },
      { group: 'LEGS', daysSince: 40 },
    ])
  })

  it('lists stale enabled moves, most stale first (never trained on top)', () => {
    expect(neglectedMoves(workouts, moves, now)).toEqual([
      { name: 'Row', daysSince: null },
      { name: 'Curl', daysSince: null },
      { name: 'Squat', daysSince: 40 },
    ])
    expect(neglectedMoves([], [], now)).toEqual([])
  })
})

describe('regimeAdherence', () => {
  const slots = [
    { slot_index: 0, kind: 'WORKOUT', template_name: 'A', gap_days: 0 },
    { slot_index: 1, kind: 'WORKOUT', template_name: 'B', gap_days: 2 },
    { slot_index: 2, kind: 'HIIT', template_name: 'C', gap_days: 2 },
  ]
  const regime = {
    name: 'Block',
    total_loops: 2,
    loop_gap_days: 3,
    started_at: at(0),
    slots,
    log: [
      { loop_no: 1, slot_index: 0, completed_at: at(0) },
      { loop_no: 1, slot_index: 1, completed_at: at(3) }, // planned gap 2, actual 3 → slip 1
    ],
  }

  it('computes fulfilled/planned, average slip and completed loops', () => {
    // nominal dues: d0, d2, d4 (loop 1); d7, d9, d11 (loop 2) → 3 planned by d5
    const a = regimeAdherence(regime, at(5))
    expect(a).not.toBeNull()
    expect(a!.fulfilled).toBe(2)
    expect(a!.planned).toBe(3)
    expect(a!.percent).toBeCloseTo((2 / 3) * 100, 3)
    expect(a!.avgSlipDays).toBeCloseTo(0.5, 5)
    expect(a!.completedLoops).toBe(0)
  })

  it('caps planned at the total slot count and counts completed loops', () => {
    const done = {
      ...regime,
      log: [
        ...regime.log,
        { loop_no: 1, slot_index: 2, completed_at: at(5) },
        { loop_no: 2, slot_index: 0, completed_at: at(8) },
        { loop_no: 2, slot_index: 1, completed_at: at(10) },
        { loop_no: 2, slot_index: 2, completed_at: at(12) },
      ],
    }
    const a = regimeAdherence(done, at(400))
    expect(a!.planned).toBe(6)
    expect(a!.fulfilled).toBe(6)
    expect(a!.completedLoops).toBe(2)
    // slips: 0, +1, +1 (d5 vs d4-due... actual gap 2 vs planned 2 → 0), loop gap 3 vs 3 → 0, 2 vs 2 → 0, 2 vs 2 → 0
    expect(a!.percent).toBeCloseTo(100, 3)
  })

  it('handles a regime with no log yet', () => {
    const fresh = { ...regime, log: [] }
    const a = regimeAdherence(fresh, at(0))
    expect(a!.fulfilled).toBe(0)
    expect(a!.planned).toBe(1)
    expect(a!.avgSlipDays).toBeNull()
  })

  it('returns null for absent or malformed documents', () => {
    expect(regimeAdherence(null, at(0))).toBeNull()
    expect(regimeAdherence({}, at(0))).toBeNull()
    expect(regimeAdherence({ ...regime, slots: [] }, at(0))).toBeNull()
    expect(regimeAdherence({ ...regime, started_at: 'nope' }, at(0))).toBeNull()
  })
})

describe('HIIT stats', () => {
  const hiit = (startedAt: number, durationS: number, phases: Array<{ phase_type: string; move_name?: string | null; duration_seconds: number }> = []) => ({
    started_at: startedAt,
    duration_seconds: durationS,
    phases,
  })

  it('sums weekly HIIT minutes', () => {
    const { labels, values } = weeklyHiitMinutes([hiit(at(0), 1200), hiit(at(1), 600)], at(0), at(1))
    expect(labels.length).toBe(1)
    expect(values[0]).toBe(30)
    expect(weeklyHiitMinutes([], null, at(0))).toEqual({ labels: [], values: [] })
  })

  it('finds the longest session', () => {
    expect(longestHiit([hiit(at(0), 900), hiit(at(1), 1500)])).toEqual({ startedAt: at(1), durationS: 1500 })
    expect(longestHiit([])).toBeNull()
  })

  it('sums work seconds per move, largest first', () => {
    const w = hiit(at(0), 1200, [
      { phase_type: 'WARMUP', move_name: null, duration_seconds: 120 },
      { phase_type: 'WORK', move_name: 'Burpees', duration_seconds: 40 },
      { phase_type: 'REST', move_name: null, duration_seconds: 20 },
      { phase_type: 'WORK', move_name: 'Squats', duration_seconds: 45 },
      { phase_type: 'WORK', move_name: 'Burpees', duration_seconds: 40 },
    ])
    expect(hiitWorkSecondsPerMove([w], null)).toEqual([
      { moveName: 'Burpees', workS: 80 },
      { moveName: 'Squats', workS: 45 },
    ])
    expect(hiitWorkSecondsPerMove([w], at(1))).toEqual([])
  })
})

describe('run stats', () => {
  const runFx = (startedAt: number, over: Partial<{
    activity_type: string
    distance_m: number
    duration_s: number
    avg_pace_s_per_km: number | null
    splits: Array<{ km: number; seconds: number }> | null
  }> = {}) => ({
    started_at: startedAt,
    activity_type: 'running',
    distance_m: 5000,
    duration_s: 1500,
    avg_pace_s_per_km: 300,
    splits: null,
    ...over,
  })

  it('builds a per-run pace trend for one activity', () => {
    const runs = [
      runFx(at(1), { avg_pace_s_per_km: null, distance_m: 4000, duration_s: 1400 }), // computed 350
      runFx(at(0)),
      runFx(at(2), { activity_type: 'walking' }),
      runFx(at(3), { distance_m: 0 }), // no distance → excluded
    ]
    expect(paceTrend(runs, 'running')).toEqual([[at(0), 300], [at(1), 350]])
    expect(paceTrend(runs, null).length).toBe(3)
    expect(paceTrend([], 'running')).toEqual([])
  })

  it('finds the fastest single km across all runs', () => {
    const runs = [
      runFx(at(0), { splits: [{ km: 1, seconds: 290 }, { km: 2, seconds: 305 }] }),
      runFx(at(1), { splits: [{ km: 1, seconds: 284 }] }),
      runFx(at(2)),
    ]
    expect(fastestKm(runs)).toEqual({ seconds: 284, startedAt: at(1) })
    expect(fastestKm([runFx(at(0))])).toBeNull()
  })

  it('finds the longest run in km', () => {
    expect(longestRun([runFx(at(0)), runFx(at(1), { distance_m: 12100 })]))
      .toEqual({ km: 12.1, startedAt: at(1) })
    expect(longestRun([])).toBeNull()
  })

  it('computes the negative-split share over runs with 2+ splits', () => {
    const runs = [
      runFx(at(0), { splits: [{ km: 1, seconds: 300 }, { km: 2, seconds: 290 }] }), // negative
      runFx(at(1), { splits: [{ km: 1, seconds: 300 }, { km: 2, seconds: 310 }] }), // positive
      runFx(at(2), { splits: [{ km: 1, seconds: 300 }] }), // ineligible
      runFx(at(3), { splits: [{ km: 1, seconds: 300 }, { km: 2, seconds: 400 }, { km: 3, seconds: 290 }] }), // odd → middle ignored, negative
    ]
    expect(negativeSplitShare(runs)).toEqual({ negative: 2, eligible: 3, sharePct: (2 / 3) * 100 })
    expect(negativeSplitShare([])).toEqual({ negative: 0, eligible: 0, sharePct: null })
  })

  it('reports per-activity current-year and all-time kilometres', () => {
    const lastYear = Date.parse('2025-06-01T12:00:00')
    const runs = [
      runFx(at(0)), // 5 km, 2026
      runFx(lastYear, { distance_m: 10000 }),
      runFx(at(1), { activity_type: 'treadmill', distance_m: 3000 }),
    ]
    expect(runMilestones(runs, at(10))).toEqual([
      { activity: 'running', yearKm: 5, allTimeKm: 15 },
      { activity: 'treadmill', yearKm: 3, allTimeKm: 3 },
    ])
    expect(runMilestones([], at(0))).toEqual([])
  })

  it('computes the treadmill share', () => {
    const runs = [
      runFx(at(0)),
      runFx(at(1), { activity_type: 'treadmill', distance_m: 3000 }),
    ]
    expect(treadmillShare(runs, null)).toEqual({ count: 1, totalCount: 2, km: 3, totalKm: 8 })
  })

  it('buckets split minutes into pace zones', () => {
    const runs = [
      runFx(at(0), {
        splits: [
          { km: 1, seconds: 280 }, // <5:00
          { km: 2, seconds: 330 }, // 5–6
          { km: 3, seconds: 400 }, // 6–7
          { km: 4, seconds: 500 }, // >7
          { km: 5, seconds: 320 }, // 5–6
        ],
      }),
    ]
    const zones = paceZones(runs, null)
    expect(zones.map((z) => z.label)).toEqual(['<5:00', '5:00–6:00', '6:00–7:00', '>7:00'])
    expect(zones[0].minutes).toBeCloseTo(280 / 60, 5)
    expect(zones[1].minutes).toBeCloseTo(650 / 60, 5)
    expect(zones[2].minutes).toBeCloseTo(400 / 60, 5)
    expect(zones[3].minutes).toBeCloseTo(500 / 60, 5)
    expect(paceZones([], null).every((z) => z.minutes === 0)).toBe(true)
  })
})

describe('rollingWeight', () => {
  it('averages entries in the trailing window, boundary exclusive', () => {
    const weights = [
      { date: '2026-07-01', grams: 80000 },
      { date: '2026-07-02', grams: 82000 },
      { date: '2026-07-08', grams: 84000 }, // 7 days after the 1st → 1st drops out
    ]
    const series = rollingWeight(weights)
    expect(series.length).toBe(3)
    expect(series[0][1]).toBe(80000)
    expect(series[1][1]).toBe(81000)
    expect(series[2][1]).toBe(83000)
  })

  it('handles a single entry and empty input', () => {
    expect(rollingWeight([{ date: '2026-07-01', grams: 80000 }])).toEqual([
      [Date.parse('2026-07-01'), 80000],
    ])
    expect(rollingWeight([])).toEqual([])
  })
})

describe('weightSlopePerWeek', () => {
  const now = Date.parse('2026-07-15T12:00:00')

  it('fits a least-squares slope in grams per week', () => {
    const weights = [
      { date: '2026-07-01', grams: 80000 },
      { date: '2026-07-08', grams: 81000 },
      { date: '2026-07-15', grams: 82000 },
    ]
    expect(weightSlopePerWeek(weights, now)).toBeCloseTo(1000, 3)
  })

  it('is zero for a flat series and null when underdetermined', () => {
    const flat = [
      { date: '2026-07-01', grams: 80000 },
      { date: '2026-07-08', grams: 80000 },
    ]
    expect(weightSlopePerWeek(flat, now)).toBeCloseTo(0, 6)
    expect(weightSlopePerWeek([{ date: '2026-07-01', grams: 80000 }], now)).toBeNull()
    expect(weightSlopePerWeek([], now)).toBeNull()
    // only one entry inside the 28-day window
    const stale = [
      { date: '2026-01-01', grams: 90000 },
      { date: '2026-07-01', grams: 80000 },
    ]
    expect(weightSlopePerWeek(stale, now)).toBeNull()
  })
})

describe('indexedPair', () => {
  const t = (d: string) => Date.parse(d)

  it('indexes both series to 100 at the start of the overlap', () => {
    const weight: Array<[number, number]> = [
      [t('2026-07-01'), 80000],
      [t('2026-07-05'), 82000],
      [t('2026-07-09'), 82000],
    ]
    const waist: Array<[number, number]> = [
      [t('2026-07-05'), 900],
      [t('2026-07-09'), 891],
    ]
    const pair = indexedPair(weight, waist)
    expect(pair).not.toBeNull()
    expect(pair!.a.map(([, v]) => v)).toEqual([100, 100])
    expect(pair!.b[0][1]).toBeCloseTo(100, 5)
    expect(pair!.b[1][1]).toBeCloseTo(99, 5)
    expect(pair!.a[0][0]).toBe(t('2026-07-05'))
  })

  it('returns null when either side has fewer than 2 overlap points', () => {
    expect(indexedPair([], [])).toBeNull()
    expect(
      indexedPair(
        [[t('2026-07-01'), 80000], [t('2026-07-02'), 80500]],
        [[t('2026-07-02'), 900]],
      ),
    ).toBeNull()
  })
})

describe('isoWeekKey', () => {
  it('matches ISO-8601 week numbering at year edges', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01')
    expect(isoWeekKey('2026-07-12')).toBe('2026-W28')
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKey('garbage')).toBeNull()
  })
})

describe('blood pressure analytics', () => {
  const readings = [
    { date: '2026-07-06', slot: 'morning', systolic: 128, diastolic: 82, pulse: 65 },
    { date: '2026-07-07', slot: 'morning', systolic: 126, diastolic: 80, pulse: null },
    { date: '2026-07-07', slot: 'evening', systolic: 124, diastolic: 80, pulse: 70 },
    { date: '2026-06-30', slot: 'evening', systolic: 131, diastolic: 85, pulse: null },
  ]

  it('averages readings per ISO week and slot, newest week first', () => {
    const rows = bpWeekly(readings)
    expect(rows.length).toBe(2)
    expect(rows[0].week).toBe('2026-W28')
    expect(rows[0].amSys).toBe(127)
    expect(rows[0].amDia).toBe(81)
    expect(rows[0].amPulse).toBe(65)
    expect(rows[0].pmSys).toBe(124)
    expect(rows[0].pmDia).toBe(80)
    expect(rows[0].pmPulse).toBe(70)
    expect(rows[0].n).toBe(3)
    expect(rows[1].week).toBe('2026-W27')
    expect(rows[1].amSys).toBeNull()
    expect(rows[1].pmSys).toBe(131)
    expect(bpWeekly([])).toEqual([])
  })

  it('computes the normal-band share (sys < 130 and dia < 85)', () => {
    expect(bpNormalShare(readings)).toBeCloseTo(75, 5)
    expect(bpNormalShare([])).toBeNull()
  })

  it('exposes a per-reading pulse series aligned with the BP chart order', () => {
    const s = bpPulseSeries(readings)
    expect(s.labels.length).toBe(4)
    expect(s.pulse).toEqual([null, 65, null, 70])
  })
})

describe('bmiTrend', () => {
  it('maps the weight series through the BMI formula when height is set', () => {
    const series = bmiTrend([{ date: '2026-07-01', grams: 80000 }], 180)
    expect(series.length).toBe(1)
    expect(series[0][1]).toBeCloseTo(24.7, 5)
    expect(bmiTrend([{ date: '2026-07-01', grams: 80000 }], null)).toEqual([])
    expect(bmiTrend([], 180)).toEqual([])
  })
})

describe('weeklyActivityMinutes', () => {
  it('stacks strength, HIIT and run minutes per week', () => {
    const res = weeklyActivityMinutes(
      [{ started_at: at(0), duration_seconds: 3600 }],
      [{ started_at: at(1), duration_seconds: 1800 }],
      [{ started_at: at(1), duration_s: 1200 }],
      at(0),
      at(1),
    )
    expect(res.labels.length).toBe(1)
    expect(res.strength).toEqual([60])
    expect(res.hiit).toEqual([30])
    expect(res.run).toEqual([20])
    expect(weeklyActivityMinutes([], [], [], null, at(0))).toEqual({
      labels: [],
      strength: [],
      hiit: [],
      run: [],
    })
  })
})

describe('yearInNumbers', () => {
  it('summarises the current calendar year', () => {
    const w2025 = { ...workout(Date.parse('2025-06-01T12:00:00'), [{ reps: 10, weight: 200 }]), duration_seconds: 3600 }
    const w2026 = { ...workout(at(0), [{ reps: 10, weight: 210 }]), duration_seconds: 3600 }
    const summary = yearInNumbers(
      [w2025, w2026],
      [{ started_at: at(1), duration_seconds: 1800 }],
      [{ started_at: at(2), activity_type: 'running', distance_m: 5000, duration_s: 1500 }],
      at(10),
    )
    expect(summary.year).toBe(2026)
    expect(summary.strengthSessions).toBe(1)
    expect(summary.hiitSessions).toBe(1)
    expect(summary.runSessions).toBe(1)
    expect(summary.totalHours).toBeCloseTo(1.9, 5)
    expect(summary.tonnage).toBe(2100)
    expect(summary.runKm).toBeCloseTo(5, 5)
    expect(summary.prCount).toBe(2) // 2026 weight + e1RM PRs beat the 2025 marks
  })

  it('zeroes out on an empty dataset', () => {
    const summary = yearInNumbers([], [], [], at(0))
    expect(summary.strengthSessions + summary.hiitSessions + summary.runSessions).toBe(0)
    expect(summary.tonnage).toBe(0)
    expect(summary.prCount).toBe(0)
  })
})
