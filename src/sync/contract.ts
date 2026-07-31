// Pure helpers for sync contract v3 — kept free of Vue/axios so Vitest covers
// them directly. Mirrors the Android app's SyncMeta rules exactly.

import type { Dataset, Tombstone, Unstamped } from '../types'

export const ENTITY = {
  MOVE: 'move',
  WORKOUT_TEMPLATE: 'workout_template',
  HIIT_TEMPLATE: 'hiit_template',
  WORKOUT: 'workout',
  HIIT_WORKOUT: 'hiit_workout',
  REGIME_TEMPLATE: 'regime_template',
  ACTIVE_REGIME: 'active_regime',
  BODY_WEIGHT: 'body_weight',
  BLOOD_PRESSURE: 'blood_pressure',
  BODY_GIRTH: 'body_girth',
  RUN_RECORD: 'run_record',
  RUN_WORKOUT: 'run_workout',
} as const

export type EntityType = (typeof ENTITY)[keyof typeof ENTITY]

export const nameKey = (name: string): string => name.trim().toLowerCase()
export const startedAtKey = (startedAt: number): string => String(startedAt)
export const ACTIVE_REGIME_KEY = 'active'

export function emptyDataset(): Dataset {
  return {
    moves: [],
    workout_templates: [],
    hiit_templates: [],
    workouts: [],
    hiit_workouts: [],
    regime_templates: [],
    active_regime: null,
    run_workouts: [],
    body_weights: [],
    profile: null,
    blood_pressures: [],
    body_girths: [],
    run_records: [],
    tombstones: [],
  }
}

/** Merge a tombstone into the list, keeping the max deleted_at per (entity, key). */
export function recordTombstone(
  tombstones: Tombstone[],
  entity: EntityType,
  key: string,
  deletedAt: number,
): Tombstone[] {
  const existing = tombstones.find((t) => t.entity === entity && t.key === key)
  if (existing) {
    existing.deleted_at = Math.max(existing.deleted_at, deletedAt)
    return tombstones
  }
  tombstones.push({ entity, key, deleted_at: deletedAt })
  return tombstones
}

/** Replace-or-append an item in a list matched by predicate, stamping updated_at. */
export function upsertStamped<T extends { updated_at: number }>(
  list: T[],
  matches: (item: T) => boolean,
  item: Unstamped<T>,
  now: number,
): T {
  const stamped = { ...item, updated_at: now } as T
  const idx = list.findIndex(matches)
  if (idx >= 0) list.splice(idx, 1, stamped)
  else list.push(stamped)
  return stamped
}
