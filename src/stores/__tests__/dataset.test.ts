import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}))

import { api } from '../../api'
import { useDatasetStore } from '../dataset'
import { emptyDataset, recordTombstone, nameKey } from '../../sync/contract'
import type { Move, RunWorkout, Tombstone, Workout } from '../../types'

// The module mock above replaces the axios instance with plain vi.fn()s.
const mockApi = api as unknown as { get: Mock; post: Mock }

describe('dataset store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.clearAllTimers()
    mockApi.get.mockReset()
    mockApi.post.mockReset()
    mockApi.get.mockResolvedValue({ data: emptyDataset() })
    mockApi.post.mockResolvedValue({ data: { status: 'ok' } })
  })

  it('stamps updated_at on upserts', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.upsertMove({ name: 'Squat', movement_height: 'LOWER' } as Move)
    expect(store.data.moves).toHaveLength(1)
    expect(store.data.moves[0].updated_at).toBe(1720000000000)
    expect(store.dirty).toBe(true)
  })

  it('replaces an existing item case-insensitively instead of duplicating', () => {
    const store = useDatasetStore()
    store.upsertMove({ name: 'Squat', weight_note: 'a' } as Move)
    store.upsertMove({ name: 'SQUAT', weight_note: 'b' } as Move)
    expect(store.data.moves).toHaveLength(1)
    expect(store.data.moves[0].weight_note).toBe('b')
  })

  it('tombstones move deletes by uuid (v4), falling back to the name key', () => {
    const store = useDatasetStore()
    vi.setSystemTime(42)
    store.upsertMove({ name: ' Push Up ' } as Move)
    const uuid = store.data.moves[0]!.uuid
    expect(uuid).toBeTruthy()
    store.deleteMove(' Push Up ')
    expect(store.data.moves).toHaveLength(0)
    expect(store.data.tombstones).toEqual([{ entity: 'move', key: uuid, deleted_at: 42 }])
  })

  it('renames a move in place when the uuid matches', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.upsertMove({ name: 'Squat' } as Move)
    const uuid = store.data.moves[0]!.uuid
    vi.setSystemTime(1720000000001)
    store.upsertMove({ name: 'Back squat', uuid } as Move)
    expect(store.data.moves).toHaveLength(1)
    expect(store.data.moves[0]!.name).toBe('Back squat')
    expect(store.data.moves[0]!.uuid).toBe(uuid)
    expect(store.data.moves[0]!.updated_at).toBe(1720000000001)
  })

  it('workout deletion tombstones by decimal started_at', () => {
    const store = useDatasetStore()
    store.data.workouts = [{ started_at: 1720000000001, updated_at: 1 } as Workout]
    vi.setSystemTime(50)
    store.deleteWorkout(1720000000001)
    expect(store.data.tombstones[0]).toEqual({
      entity: 'workout',
      key: '1720000000001',
      deleted_at: 50,
    })
  })

  it('tombstones merge by max deleted_at', () => {
    const tombstones: Tombstone[] = []
    recordTombstone(tombstones, 'move', 'x', 100)
    recordTombstone(tombstones, 'move', 'x', 50)
    expect(tombstones).toEqual([{ entity: 'move', key: 'x', deleted_at: 100 }])
  })

  it('debounces the push and re-pulls after it', async () => {
    const store = useDatasetStore()
    store.upsertMove({ name: 'A' } as Move)
    store.upsertMove({ name: 'B' } as Move)
    expect(api.post).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2100)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/sync', expect.objectContaining({ moves: expect.any(Array) }))
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(store.dirty).toBe(false)
  })

  it('push failure keeps dirty and surfaces the error', async () => {
    const store = useDatasetStore()
    mockApi.post.mockRejectedValue(new Error('boom'))
    store.upsertMove({ name: 'A' } as Move)
    await vi.advanceTimersByTimeAsync(2100)
    expect(store.error).toContain('boom')
    expect(store.dirty).toBe(true)
  })

  it('nameKey matches the contract normalization', () => {
    expect(nameKey(' Push Up ')).toBe('push up')
  })

  it('stamps body-weight upserts and overwrites the same date', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.upsertBodyWeight('2026-07-10', 84600)
    store.upsertBodyWeight('2026-07-10', 85000)
    expect(store.data.body_weights).toHaveLength(1)
    expect(store.data.body_weights[0]).toEqual({ date: '2026-07-10', grams: 85000, updated_at: 1720000000000 })
    expect(store.dirty).toBe(true)
  })

  it('tombstones body-weight deletes by raw date key', () => {
    const store = useDatasetStore()
    vi.setSystemTime(42)
    store.upsertBodyWeight('2026-07-10', 84600)
    store.deleteBodyWeight('2026-07-10')
    expect(store.data.body_weights).toHaveLength(0)
    expect(store.data.tombstones).toEqual([{ entity: 'body_weight', key: '2026-07-10', deleted_at: 42 }])
  })

  it('sets and clears profile height with a fresh stamp', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.setProfileHeight(178)
    expect(store.data.profile).toEqual({ height_cm: 178, updated_at: 1720000000000 })
    vi.setSystemTime(1720000000001)
    store.setProfileHeight(null)
    expect(store.data.profile).toEqual({ height_cm: null, updated_at: 1720000000001 })
    expect(store.dirty).toBe(true)
  })

  it('stamps blood-pressure upserts and overwrites the same date+slot', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.upsertBloodPressure('2026-07-12', 'morning', 128, 82, 65)
    store.upsertBloodPressure('2026-07-12', 'morning', 130, 85)
    store.upsertBloodPressure('2026-07-12', 'evening', 125, 81, 70)
    expect(store.data.blood_pressures).toHaveLength(2)
    expect(store.data.blood_pressures[0]).toEqual({
      date: '2026-07-12', slot: 'morning', systolic: 130, diastolic: 85,
      pulse: null, updated_at: 1720000000000,
    })
  })

  it('tombstones blood-pressure deletes with a date|slot key', () => {
    const store = useDatasetStore()
    vi.setSystemTime(42)
    store.upsertBloodPressure('2026-07-12', 'morning', 128, 82, 65)
    store.deleteBloodPressure('2026-07-12', 'morning')
    expect(store.data.blood_pressures).toHaveLength(0)
    expect(store.data.tombstones).toEqual([
      { entity: 'blood_pressure', key: '2026-07-12|morning', deleted_at: 42 },
    ])
  })

  it('stamps body-girth upserts and overwrites the same date+kind', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.upsertBodyGirth('2026-07-12', 'waist', 940)
    store.upsertBodyGirth('2026-07-12', 'waist', 935)
    store.upsertBodyGirth('2026-07-12', 'chest', 1010)
    expect(store.data.body_girths).toHaveLength(2)
    expect(store.data.body_girths[0]).toEqual({
      date: '2026-07-12', kind: 'waist', mm: 935, updated_at: 1720000000000,
    })
  })

  it('tombstones body-girth deletes with a date|kind key', () => {
    const store = useDatasetStore()
    vi.setSystemTime(42)
    store.upsertBodyGirth('2026-07-12', 'waist', 940)
    store.deleteBodyGirth('2026-07-12', 'waist')
    expect(store.data.body_girths).toHaveLength(0)
    expect(store.data.tombstones).toEqual([
      { entity: 'body_girth', key: '2026-07-12|waist', deleted_at: 42 },
    ])
  })


  it('stamps run-workout tag updates', () => {
    const store = useDatasetStore()
    vi.setSystemTime(1720000000000)
    store.data.run_workouts.push({ started_at: 500, route_tag: '', distance_m: 5000, updated_at: 1 } as RunWorkout)
    store.updateRunWorkout(500, { route_tag: 'lake loop' })
    expect(store.data.run_workouts[0].route_tag).toBe('lake loop')
    expect(store.data.run_workouts[0].updated_at).toBe(1720000000000)
    expect(store.dirty).toBe(true)
  })

  it('tombstones run-workout deletes by started_at key', () => {
    const store = useDatasetStore()
    vi.setSystemTime(77)
    store.data.run_workouts.push({ started_at: 500, route_tag: '', distance_m: 5000, updated_at: 1 } as RunWorkout)
    store.deleteRunWorkout(500)
    expect(store.data.run_workouts).toHaveLength(0)
    expect(store.data.tombstones).toEqual([{ entity: 'run_workout', key: '500', deleted_at: 77 }])
  })

})
