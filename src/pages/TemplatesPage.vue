<template>
  <q-page padding>
    <q-tabs v-model="tab" dense align="left" class="q-mb-md">
      <q-tab name="workout" label="Workout" />
      <q-tab name="hiit" label="HIIT" />
      <q-tab name="regime" label="Regime" />
    </q-tabs>

    <!-- Workout templates -->
    <div v-if="tab === 'workout'">
      <q-btn color="primary" icon="add" label="New template" class="q-mb-sm" @click="openWorkoutEditor()" />
      <q-list bordered separator>
        <q-item v-for="t in dataset.data.workout_templates" :key="t.name">
          <q-item-section>
            <q-item-label>{{ t.name }}</q-item-label>
            <q-item-label caption>{{ t.entries.length }} sets</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div>
              <q-btn flat dense icon="edit" @click="openWorkoutEditor(t)" />
              <q-btn flat dense icon="delete" color="negative" @click="del('workout', t.name)" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- HIIT templates -->
    <div v-if="tab === 'hiit'">
      <q-btn color="primary" icon="add" label="New HIIT template" class="q-mb-sm" @click="openHiitEditor()" />
      <q-list bordered separator>
        <q-item v-for="t in dataset.data.hiit_templates" :key="t.name">
          <q-item-section>
            <q-item-label>{{ t.name }}</q-item-label>
            <q-item-label caption>
              {{ t.rounds.length }} rounds · warmup {{ t.warmup_seconds }}s · cooldown {{ t.cooldown_seconds }}s
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div>
              <q-btn flat dense icon="edit" @click="openHiitEditor(t)" />
              <q-btn flat dense icon="delete" color="negative" @click="del('hiit', t.name)" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Regime templates -->
    <div v-if="tab === 'regime'">
      <q-btn color="primary" icon="add" label="New regime" class="q-mb-sm" @click="openRegimeEditor()" />
      <q-list bordered separator>
        <q-item v-for="t in dataset.data.regime_templates" :key="t.name">
          <q-item-section>
            <q-item-label>{{ t.name }}</q-item-label>
            <q-item-label caption>{{ t.total_loops }} loops · {{ t.slots.length }} slots</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div>
              <q-btn flat dense icon="edit" @click="openRegimeEditor(t)" />
              <q-btn flat dense icon="delete" color="negative" @click="del('regime', t.name)" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Workout template editor -->
    <q-dialog v-model="workoutEditor.open">
      <q-card style="width: 640px; max-width: 95vw">
        <q-card-section class="text-h6">Workout template</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="workoutEditor.name" label="Name" outlined dense />
          <div v-for="(e, i) in workoutEditor.entries" :key="i" class="row q-gutter-xs items-center">
            <q-select v-model="e.move_name" :options="moveNames" label="Move" outlined dense class="col" use-input @filter="filterMoves" />
            <q-input v-model.number="e.set_no" type="number" label="Set" outlined dense style="width: 64px" />
            <q-input v-model.number="e.reps" type="number" label="Reps" outlined dense style="width: 72px" />
            <q-input v-model.number="e.weight" type="number" step="0.5" label="Kg" outlined dense style="width: 80px" />
            <q-input v-model.number="e.duration_seconds" type="number" label="Sec" outlined dense style="width: 72px" />
            <q-btn flat dense icon="close" @click="workoutEditor.entries.splice(i, 1)" />
          </div>
          <q-btn flat icon="add" label="Add set" @click="addWorkoutEntry" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" :disable="!workoutEditor.name.trim() || !workoutEditor.entries.length" @click="saveWorkoutTemplate" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- HIIT template editor -->
    <q-dialog v-model="hiitEditor.open">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">HIIT template</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="hiitEditor.name" label="Name" outlined dense />
          <div class="row q-gutter-sm">
            <q-input v-model.number="hiitEditor.warmup_seconds" type="number" label="Warmup (s)" outlined dense class="col" />
            <q-input v-model.number="hiitEditor.cooldown_seconds" type="number" label="Cooldown (s)" outlined dense class="col" />
          </div>
          <div v-for="(r, i) in hiitEditor.rounds" :key="i" class="row q-gutter-xs items-center">
            <q-select v-model="r.move_name" :options="moveNames" label="Move" outlined dense class="col" use-input @filter="filterMoves" />
            <q-input v-model.number="r.activity_seconds" type="number" label="Work (s)" outlined dense style="width: 90px" />
            <q-input v-model.number="r.rest_seconds" type="number" label="Rest (s)" outlined dense style="width: 90px" />
            <q-btn flat dense icon="close" @click="hiitEditor.rounds.splice(i, 1)" />
          </div>
          <q-btn flat icon="add" label="Add round" @click="hiitEditor.rounds.push({ round_index: hiitEditor.rounds.length + 1, move_name: null, activity_seconds: 30, rest_seconds: 15 })" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" :disable="!hiitEditor.name.trim() || !hiitEditor.rounds.length" @click="saveHiitTemplate" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Regime template editor -->
    <q-dialog v-model="regimeEditor.open">
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="text-h6">Regime template</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="regimeEditor.name" label="Name" outlined dense />
          <div class="row q-gutter-sm">
            <q-input v-model.number="regimeEditor.total_loops" type="number" label="Loops" outlined dense class="col" />
            <q-input v-model.number="regimeEditor.loop_gap_days" type="number" label="Loop gap (days)" outlined dense class="col" />
          </div>
          <div v-for="(slot, i) in regimeEditor.slots" :key="i" class="row q-gutter-xs items-center">
            <q-select v-model="slot.kind" :options="['STRENGTH', 'HIIT']" label="Kind" outlined dense style="width: 130px" />
            <q-select
              v-model="slot.template_name"
              :options="slot.kind === 'HIIT' ? hiitTemplateNames : workoutTemplateNames"
              label="Template"
              outlined dense class="col"
            />
            <q-input v-model.number="slot.gap_days" type="number" label="Gap (d)" outlined dense style="width: 80px" />
            <q-btn flat dense icon="close" @click="regimeEditor.slots.splice(i, 1)" />
          </div>
          <q-btn flat icon="add" label="Add slot" @click="regimeEditor.slots.push({ slot_index: regimeEditor.slots.length, kind: 'STRENGTH', template_name: null, gap_days: 1 })" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary" label="Save"
            :disable="!regimeEditor.name.trim() || !regimeEditor.slots.length || regimeEditor.slots.some((s) => !s.template_name)"
            @click="saveRegimeTemplate" v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useDatasetStore } from '../stores/dataset'
import type {
  HiitRound,
  HiitTemplate,
  RegimeSlot,
  RegimeTemplate,
  TemplateEntry,
  Unstamped,
  WorkoutTemplate,
} from '../types'

// Editor drafts allow a null move/template selection until the user picks one.
type TemplateEntryDraft = Omit<TemplateEntry, 'move_name'> & { move_name: string | null }
type HiitRoundDraft = Omit<HiitRound, 'move_name'> & { move_name: string | null }
type RegimeSlotDraft = Omit<RegimeSlot, 'template_name'> & { template_name: string | null }

const dataset = useDatasetStore()
const $q = useQuasar()
const tab = ref('workout')

const allMoveNames = computed(() => dataset.data.moves.filter((m) => m.is_enabled).map((m) => m.name))
const moveNames = ref<string[]>([])
function filterMoves(val: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = val.toLowerCase()
    moveNames.value = allMoveNames.value.filter((n) => n.toLowerCase().includes(needle))
  })
}
const workoutTemplateNames = computed(() => dataset.data.workout_templates.map((t) => t.name))
const hiitTemplateNames = computed(() => dataset.data.hiit_templates.map((t) => t.name))

function del(kind: string, name: string) {
  $q.dialog({ title: 'Delete template', message: `Delete "${name}" everywhere?`, cancel: true }).onOk(() => {
    if (kind === 'workout') dataset.deleteWorkoutTemplate(name)
    else if (kind === 'hiit') dataset.deleteHiitTemplate(name)
    else dataset.deleteRegimeTemplate(name)
  })
}

// Workout templates
const workoutEditor = ref<{ open: boolean; name: string; created_at: number; entries: TemplateEntryDraft[] }>(
  { open: false, name: '', created_at: 0, entries: [] },
)
function openWorkoutEditor(t?: WorkoutTemplate) {
  workoutEditor.value = t
    ? { open: true, name: t.name, created_at: t.created_at, entries: t.entries.map((e) => ({ ...e })) }
    : { open: true, name: '', created_at: Date.now(), entries: [] }
}
function addWorkoutEntry() {
  const last = workoutEditor.value.entries.at(-1)
  workoutEditor.value.entries.push({
    move_name: last?.move_name ?? null,
    move_idx: last ? last.move_idx : 1,
    set_no: last ? last.set_no + 1 : 1,
    reps: last?.reps ?? 8,
    weight: last?.weight ?? 0,
    duration_seconds: 0,
  })
}
function uuidOfMove(name: string | null): string | null {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return dataset.data.moves.find((m) => m.name.trim().toLowerCase() === key)?.uuid ?? null
}

function saveWorkoutTemplate() {
  const e = workoutEditor.value
  // Recompute move_idx by consecutive move grouping, mirroring the app's model.
  let idx = 0
  let prev: string | null = null
  const entries = e.entries.map((entry) => {
    if (entry.move_name !== prev) {
      idx += 1
      prev = entry.move_name
    }
    return { ...entry, move_idx: idx, move_uuid: uuidOfMove(entry.move_name) }
  })
  // Drafts may still carry a null move_name; saved unchanged (pre-existing behavior).
  dataset.upsertWorkoutTemplate(
    { name: e.name.trim(), created_at: e.created_at, entries } as Unstamped<WorkoutTemplate>,
  )
}

// HIIT templates
const hiitEditor = ref<{
  open: boolean
  name: string
  warmup_seconds: number
  cooldown_seconds: number
  created_at: number
  rounds: HiitRoundDraft[]
}>({ open: false, name: '', warmup_seconds: 60, cooldown_seconds: 60, created_at: 0, rounds: [] })
function openHiitEditor(t?: HiitTemplate) {
  hiitEditor.value = t
    ? { open: true, ...JSON.parse(JSON.stringify(t)) }
    : { open: true, name: '', warmup_seconds: 60, cooldown_seconds: 60, created_at: Date.now(), rounds: [] }
}
function saveHiitTemplate() {
  const e = hiitEditor.value
  const rounds = e.rounds.map((r, i) => ({ ...r, round_index: i + 1, move_uuid: uuidOfMove(r.move_name) }))
  // Drafts may still carry a null move_name; saved unchanged (pre-existing behavior).
  dataset.upsertHiitTemplate({
    name: e.name.trim(),
    warmup_seconds: e.warmup_seconds || 0,
    cooldown_seconds: e.cooldown_seconds || 0,
    created_at: e.created_at,
    rounds,
  } as Unstamped<HiitTemplate>)
}

// Regime templates
const regimeEditor = ref<{
  open: boolean
  name: string
  total_loops: number
  loop_gap_days: number
  created_at: number
  slots: RegimeSlotDraft[]
}>({ open: false, name: '', total_loops: 4, loop_gap_days: 1, created_at: 0, slots: [] })
function openRegimeEditor(t?: RegimeTemplate) {
  regimeEditor.value = t
    ? { open: true, ...JSON.parse(JSON.stringify(t)) }
    : { open: true, name: '', total_loops: 4, loop_gap_days: 1, created_at: Date.now(), slots: [] }
}
function saveRegimeTemplate() {
  const e = regimeEditor.value
  const slots = e.slots.map((s, i) => ({ ...s, slot_index: i }))
  // Save is disabled while any slot lacks a template, so template_name is set here.
  dataset.upsertRegimeTemplate({
    name: e.name.trim(),
    total_loops: e.total_loops || 1,
    loop_gap_days: e.loop_gap_days || 0,
    created_at: e.created_at,
    slots,
  } as Unstamped<RegimeTemplate>)
}
</script>
