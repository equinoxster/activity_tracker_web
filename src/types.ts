// Sync-contract (v3) document model. Field lists mirror the backend's JSON
// tags (training-calculator-backup internal/model/model.go) and match
// emptyDataset() in src/sync/contract.ts exactly.

export interface Move {
  uuid?: string
  name: string
  movement_height: string
  movement_group: string
  weight_note: string
  is_enabled: boolean
  laterality: string
  tracking_mode: string
  updated_at: number
}

export interface WorkoutEntry {
  move_uuid?: string | null
  move_name: string
  move_idx: number
  set_no: number
  reps: number
  weight: number
  performed_at: number
  side: string
  duration_seconds: number
}

export interface Workout {
  started_at: number
  ended_at: number
  duration_seconds: number
  entries: WorkoutEntry[]
  updated_at: number
}

export interface TemplateEntry {
  move_uuid?: string | null
  move_name: string
  move_idx: number
  set_no: number
  reps: number
  weight: number
  duration_seconds: number
}

export interface WorkoutTemplate {
  name: string
  created_at: number
  entries: TemplateEntry[]
  updated_at: number
}

export interface HiitRound {
  move_uuid?: string | null
  round_index: number
  move_name: string
  activity_seconds: number
  rest_seconds: number
}

export interface HiitTemplate {
  name: string
  warmup_seconds: number
  cooldown_seconds: number
  created_at: number
  rounds: HiitRound[]
  updated_at: number
}

export interface HiitPhase {
  move_uuid?: string | null
  phase_index: number
  phase_type: string
  round_index?: number | null
  move_name?: string | null
  duration_seconds: number
}

export interface HiitWorkout {
  started_at: number
  ended_at: number
  duration_seconds: number
  warmup_seconds: number
  cooldown_seconds: number
  round_count: number
  total_activity_seconds: number
  total_rest_seconds: number
  template_name: string
  phases: HiitPhase[]
  updated_at: number
}

/** One kilometre split of a run. */
export interface RunSplit {
  km: number
  seconds: number
}

/** GPS track point in the sync-document format: [lat, lon, t]. */
export type RunPoint = [number, number, number]

export interface RunWorkout {
  started_at: number
  ended_at: number
  activity_type: string
  route_tag: string
  distance_m: number
  duration_s: number
  avg_pace_s_per_km: number | null
  max_speed_mps: number
  splits: RunSplit[] | null
  points: RunPoint[] | null
  updated_at: number
}

export interface BodyWeight {
  date: string
  grams: number
  updated_at: number
}

export interface Profile {
  height_cm: number | null
  updated_at: number
}

export type BloodPressureSlot = 'morning' | 'evening'
export type GirthKind = 'waist' | 'chest'

/** Best time over a canonical distance, computed by the app from run splits. */
export interface RunRecord {
  distance_km: number
  seconds: number
  run_started_at: number
  updated_at: number
}


/** One circumference reading; mm is the stored unit, display converts. */
export interface BodyGirth {
  date: string
  kind: GirthKind
  mm: number
  updated_at: number
}


export interface BloodPressure {
  date: string
  slot: BloodPressureSlot
  systolic: number
  diastolic: number
  pulse: number | null
  updated_at: number
}

export interface Tombstone {
  entity: string
  key: string
  deleted_at: number
}

export interface RegimeSlot {
  slot_index: number
  kind: string
  template_name: string
  gap_days: number
}

// Regime documents are client-owned JSON stored verbatim by the server; these
// are the fields the webapp reads and writes.
export interface RegimeTemplate {
  name: string
  total_loops: number
  loop_gap_days: number
  created_at: number
  slots: RegimeSlot[]
  updated_at: number
}

// Opaque client-owned document: the webapp only checks presence and clears it.
export interface ActiveRegime {
  [key: string]: unknown
}

export interface Dataset {
  moves: Move[]
  workout_templates: WorkoutTemplate[]
  hiit_templates: HiitTemplate[]
  workouts: Workout[]
  hiit_workouts: HiitWorkout[]
  regime_templates: RegimeTemplate[]
  active_regime: ActiveRegime | null
  run_workouts: RunWorkout[]
  body_weights: BodyWeight[]
  profile: Profile | null
  blood_pressures: BloodPressure[]
  body_girths: BodyGirth[]
  run_records: RunRecord[]
  tombstones: Tombstone[]
}

/** Server-side photo list entry (GET /api/photos). */
export interface RemotePhoto {
  id: number
  taken_at: number
  size_bytes: number
}

/**
 * Input shape for LWW upserts: the store stamps `updated_at` itself, so
 * callers may omit it (fresh forms) or carry a stale one (edited copies).
 */
export type Unstamped<T extends { updated_at: number }> = Omit<T, 'updated_at'> & {
  updated_at?: number
}
