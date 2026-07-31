import { defineStore } from 'pinia'
import { api } from '../api'
import {
  ENTITY,
  ACTIVE_REGIME_KEY,
  emptyDataset,
  nameKey,
  startedAtKey,
  recordTombstone,
  upsertStamped,
} from '../sync/contract'
import type { GirthKind,
  BloodPressureSlot,
  Dataset,
  HiitTemplate,
  Move,
  RegimeTemplate,
  RunWorkout,
  Unstamped,
  Workout,
  WorkoutTemplate,
} from '../types'

const PUSH_DEBOUNCE_MS = 2000

// Kept outside Pinia state: a reactive proxy around a Timeout breaks clearTimeout.
let pushTimer: ReturnType<typeof setTimeout> | null = null

interface DatasetState {
  data: Dataset
  loaded: boolean
  dirty: boolean
  syncing: boolean
  error: string
}

// The webapp is a sync client: it holds the full dataset, stamps updated_at on
// every mutation, records tombstones for deletions, and pushes the whole
// document (the server merges LWW). No per-entity endpoints exist.
export const useDatasetStore = defineStore('dataset', {
  state: (): DatasetState => ({
    data: emptyDataset(),
    loaded: false,
    dirty: false,
    syncing: false,
    error: '',
  }),
  actions: {
    async load() {
      this.syncing = true
      this.error = ''
      try {
        const { data } = await api.get<Dataset>('/api/sync')
        this.data = { ...emptyDataset(), ...data }
        this.loaded = true
        this.dirty = false
      } catch (e) {
        this.error = `Load failed: ${(e as Error).message}`
      } finally {
        this.syncing = false
      }
    },

    async push() {
      if (pushTimer) {
        clearTimeout(pushTimer)
        pushTimer = null
      }
      this.syncing = true
      this.error = ''
      try {
        await api.post('/api/sync', this.data)
        const { data } = await api.get<Dataset>('/api/sync')
        this.data = { ...emptyDataset(), ...data }
        this.dirty = false
      } catch (e) {
        this.error = `Sync failed: ${(e as Error).message}`
      } finally {
        this.syncing = false
      }
    },

    syncNow() {
      return this.push()
    },

    _markDirty() {
      this.dirty = true
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => this.push(), PUSH_DEBOUNCE_MS)
    },

    // ── moves ──
    upsertMove(move: Unstamped<Move>) {
      // Identity is the uuid (contract v4); the name is mutable, so renames
      // replace the same row instead of duplicating it.
      const existing = this.data.moves.find((m) =>
        move.uuid ? m.uuid === move.uuid : nameKey(m.name) === nameKey(move.name),
      )
      const uuid = move.uuid ?? existing?.uuid ?? crypto.randomUUID()
      upsertStamped(
        this.data.moves,
        (m) => (m.uuid ? m.uuid === uuid : nameKey(m.name) === nameKey(move.name)),
        { ...move, uuid },
        Date.now(),
      )
      this._markDirty()
    },
    deleteMove(name: string) {
      const key = nameKey(name)
      const move = this.data.moves.find((m) => nameKey(m.name) === key)
      this.data.moves = this.data.moves.filter((m) => nameKey(m.name) !== key)
      recordTombstone(this.data.tombstones, ENTITY.MOVE, move?.uuid ?? key, Date.now())
      this._markDirty()
    },

    // ── run workouts ──
    updateRunWorkout(startedAt: number, patch: Partial<RunWorkout>) {
      const idx = this.data.run_workouts.findIndex((w) => w.started_at === startedAt)
      if (idx < 0) return
      this.data.run_workouts.splice(idx, 1, { ...this.data.run_workouts[idx], ...patch, updated_at: Date.now() })
      this._markDirty()
    },
    deleteRunWorkout(startedAt: number) {
      this.data.run_workouts = this.data.run_workouts.filter((w) => w.started_at !== startedAt)
      recordTombstone(this.data.tombstones, ENTITY.RUN_WORKOUT, startedAtKey(startedAt), Date.now())
      this._markDirty()
    },

    // ── body weights ──
    upsertBodyWeight(date: string, grams: number) {
      upsertStamped(this.data.body_weights, (b) => b.date === date, { date, grams }, Date.now())
      this._markDirty()
    },
    deleteBodyWeight(date: string) {
      this.data.body_weights = this.data.body_weights.filter((b) => b.date !== date)
      recordTombstone(this.data.tombstones, ENTITY.BODY_WEIGHT, date, Date.now())
      this._markDirty()
    },

    // ── profile (height) ──
    setProfileHeight(heightCm: number | null) {
      this.data.profile = { height_cm: heightCm, updated_at: Date.now() }
      this._markDirty()
    },

    // ── blood pressures ──
    upsertBloodPressure(
      date: string,
      slot: BloodPressureSlot,
      systolic: number,
      diastolic: number,
      pulse?: number | null,
    ) {
      upsertStamped(
        this.data.blood_pressures,
        (b) => b.date === date && b.slot === slot,
        { date, slot, systolic, diastolic, pulse: pulse ?? null },
        Date.now(),
      )
      this._markDirty()
    },
    deleteBloodPressure(date: string, slot: BloodPressureSlot) {
      this.data.blood_pressures = this.data.blood_pressures.filter(
        (b) => !(b.date === date && b.slot === slot),
      )
      recordTombstone(this.data.tombstones, ENTITY.BLOOD_PRESSURE, `${date}|${slot}`, Date.now())
      this._markDirty()
    },

    // ── body girths ──
    upsertBodyGirth(date: string, kind: GirthKind, mm: number) {
      upsertStamped(this.data.body_girths, (g) => g.date === date && g.kind === kind, { date, kind, mm }, Date.now())
      this._markDirty()
    },
    deleteBodyGirth(date: string, kind: GirthKind) {
      this.data.body_girths = this.data.body_girths.filter((g) => !(g.date === date && g.kind === kind))
      recordTombstone(this.data.tombstones, ENTITY.BODY_GIRTH, `${date}|${kind}`, Date.now())
      this._markDirty()
    },

    // ── workout templates ──
    upsertWorkoutTemplate(template: Unstamped<WorkoutTemplate>) {
      upsertStamped(
        this.data.workout_templates,
        (t) => nameKey(t.name) === nameKey(template.name),
        template,
        Date.now(),
      )
      this._markDirty()
    },
    deleteWorkoutTemplate(name: string) {
      const key = nameKey(name)
      this.data.workout_templates = this.data.workout_templates.filter((t) => nameKey(t.name) !== key)
      recordTombstone(this.data.tombstones, ENTITY.WORKOUT_TEMPLATE, key, Date.now())
      this._markDirty()
    },

    // ── HIIT templates ──
    upsertHiitTemplate(template: Unstamped<HiitTemplate>) {
      upsertStamped(
        this.data.hiit_templates,
        (t) => nameKey(t.name) === nameKey(template.name),
        template,
        Date.now(),
      )
      this._markDirty()
    },
    deleteHiitTemplate(name: string) {
      const key = nameKey(name)
      this.data.hiit_templates = this.data.hiit_templates.filter((t) => nameKey(t.name) !== key)
      recordTombstone(this.data.tombstones, ENTITY.HIIT_TEMPLATE, key, Date.now())
      this._markDirty()
    },

    // ── workouts ──
    updateWorkout(startedAt: number, patch: Partial<Workout>) {
      const idx = this.data.workouts.findIndex((w) => w.started_at === startedAt)
      if (idx < 0) return
      this.data.workouts.splice(idx, 1, { ...this.data.workouts[idx], ...patch, updated_at: Date.now() })
      this._markDirty()
    },
    deleteWorkout(startedAt: number) {
      this.data.workouts = this.data.workouts.filter((w) => w.started_at !== startedAt)
      recordTombstone(this.data.tombstones, ENTITY.WORKOUT, startedAtKey(startedAt), Date.now())
      this._markDirty()
    },
    deleteHiitWorkout(startedAt: number) {
      this.data.hiit_workouts = this.data.hiit_workouts.filter((w) => w.started_at !== startedAt)
      recordTombstone(this.data.tombstones, ENTITY.HIIT_WORKOUT, startedAtKey(startedAt), Date.now())
      this._markDirty()
    },

    // ── regime templates ──
    upsertRegimeTemplate(template: Unstamped<RegimeTemplate>) {
      upsertStamped(
        this.data.regime_templates,
        (t) => nameKey(t.name) === nameKey(template.name),
        template,
        Date.now(),
      )
      this._markDirty()
    },
    deleteRegimeTemplate(name: string) {
      const key = nameKey(name)
      this.data.regime_templates = this.data.regime_templates.filter((t) => nameKey(t.name) !== key)
      recordTombstone(this.data.tombstones, ENTITY.REGIME_TEMPLATE, key, Date.now())
      this._markDirty()
    },
    endActiveRegime() {
      if (!this.data.active_regime) return
      this.data.active_regime = null
      recordTombstone(this.data.tombstones, ENTITY.ACTIVE_REGIME, ACTIVE_REGIME_KEY, Date.now())
      this._markDirty()
    },
  },
})
