<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-h6">History</div>
      <q-space />
      <q-select v-model="typeFilter" :options="['All', 'Strength', 'HIIT', 'Run']" dense outlined style="width: 130px" />
      <q-select v-model="monthFilter" :options="monthOptions" dense outlined clearable label="Month" style="width: 170px" />
    </div>

    <q-list bordered separator>
      <q-expansion-item v-for="item in filtered" :key="item.kind + item.started_at">
        <template #header>
          <q-item-section avatar>
            <q-icon :name="item.kind === 'hiit' ? 'timer' : item.kind === 'run' ? 'directions_run' : 'fitness_center'" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ headerFor(item) }}</q-item-label>
            <q-item-label caption>{{ formatDate(item.started_at) }} · {{ formatDuration(item.kind === 'run' ? item.duration_s : item.duration_seconds) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense icon="delete" color="negative" @click.stop="confirmDelete(item)" />
          </q-item-section>
        </template>

        <q-card v-if="item.kind === 'strength'">
          <q-card-section>
            <q-markup-table dense flat>
              <thead>
                <tr><th class="text-left">Move</th><th>Set</th><th>Reps</th><th>Weight</th><th>Side</th><th>Duration</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="(e, i) in item.entries" :key="i">
                  <td class="text-left">{{ e.move_name }}</td>
                  <td class="text-center">{{ e.set_no }}</td>
                  <td class="text-center">{{ e.reps }}</td>
                  <td class="text-center">{{ e.weight }}</td>
                  <td class="text-center">{{ e.side }}</td>
                  <td class="text-center">{{ e.duration_seconds || '—' }}</td>
                  <td><q-btn flat dense icon="edit" size="sm" @click="editEntry(item, i)" /></td>
                </tr>
              </tbody>
            </q-markup-table>
          </q-card-section>
        </q-card>

        <q-card v-else-if="item.kind === 'run'">
          <q-card-section>
            <div v-if="item.activity_type === 'treadmill'" class="text-caption q-mb-sm">
              {{ item.distance_m > 0 ? (item.distance_m / 1000).toFixed(2) + ' km' : '—' }} ·
              {{ formatDuration(item.duration_s) }}
              <span v-if="item.distance_m > 0"> · pace {{ formatPace(item.avg_pace_s_per_km) }}</span>
            </div>
            <div v-else class="text-caption q-mb-sm">
              {{ (item.distance_m / 1000).toFixed(2) }} km · {{ formatDuration(item.duration_s) }} ·
              pace {{ formatPace(item.avg_pace_s_per_km) }} · max {{ (item.max_speed_mps * 3.6).toFixed(1) }} km/h
              <span v-if="item.route_tag"> · {{ item.route_tag }}</span>
              <q-btn flat dense size="sm" icon="edit" class="q-ml-sm" @click="editRunTag(item)" />
            </div>
            <q-markup-table v-if="(item.splits || []).length" dense flat class="q-mb-sm" style="max-width: 260px">
              <thead>
                <tr><th class="text-left">km</th><th class="text-left">Time</th></tr>
              </thead>
              <tbody>
                <tr v-for="s in item.splits || []" :key="s.km">
                  <td>{{ s.km }}</td>
                  <td>{{ formatSplit(s.seconds) }}</td>
                </tr>
              </tbody>
            </q-markup-table>
            <RunMap v-if="(item.points || []).length >= 2" :points="item.points || []" />
          </q-card-section>
        </q-card>

        <q-card v-else>
          <q-card-section class="text-caption">
            {{ item.template_name }} — {{ item.round_count }} rounds,
            work {{ formatDuration(item.total_activity_seconds) }},
            rest {{ formatDuration(item.total_rest_seconds) }}
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>

    <q-dialog v-model="runTagEditor.open">
      <q-card style="width: 320px">
        <q-card-section class="text-h6">Edit route tag</q-card-section>
        <q-card-section>
          <q-input v-model="runTagEditor.tag" label="Route tag (same tag = same route)" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" @click="saveRunTag" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="entryEditor.open">
      <q-card style="width: 320px">
        <q-card-section class="text-h6">Edit set</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model.number="entryEditor.reps" type="number" label="Reps" outlined dense />
          <q-input v-model.number="entryEditor.weight" type="number" step="0.5" label="Weight (kg)" outlined dense />
          <q-input v-model.number="entryEditor.duration" type="number" label="Duration (s)" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" @click="saveEntry" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useDatasetStore } from '../stores/dataset'
import RunMap from '../components/RunMap.vue'
import type { HiitWorkout, RunWorkout, Workout } from '../types'

type HistoryItem =
  | (Workout & { kind: 'strength' })
  | (HiitWorkout & { kind: 'hiit' })
  | (RunWorkout & { kind: 'run' })

const dataset = useDatasetStore()
const $q = useQuasar()
const typeFilter = ref('All')
const monthFilter = ref<string | null>(null)

const all = computed<HistoryItem[]>(() => {
  const strength = dataset.data.workouts.map((w) => ({ ...w, kind: 'strength' as const }))
  const hiit = dataset.data.hiit_workouts.map((w) => ({ ...w, kind: 'hiit' as const }))
  const runs = dataset.data.run_workouts.map((w) => ({ ...w, kind: 'run' as const }))
  return [...strength, ...hiit, ...runs].sort((a, b) => b.started_at - a.started_at)
})

const monthOptions = computed(() => {
  const seen = new Set()
  for (const w of all.value) seen.add(monthLabel(w.started_at))
  return [...seen]
})

const filtered = computed(() =>
  all.value.filter((w) => {
    if (typeFilter.value === 'Strength' && w.kind !== 'strength') return false
    if (typeFilter.value === 'HIIT' && w.kind !== 'hiit') return false
    if (typeFilter.value === 'Run' && w.kind !== 'run') return false
    if (monthFilter.value && monthLabel(w.started_at) !== monthFilter.value) return false
    return true
  }),
)

function monthLabel(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}
function formatDate(ms: number) {
  return new Date(ms).toLocaleString()
}
function formatDuration(s: number) {
  if (!s) return '0 min'
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
function headerFor(item: HistoryItem) {
  if (item.kind === 'run') {
    const label =
      item.activity_type === 'walking' ? 'Walk' : item.activity_type === 'treadmill' ? 'Treadmill' : 'Run'
    if (item.activity_type === 'treadmill') {
      return item.distance_m > 0 ? `${label} — ${(item.distance_m / 1000).toFixed(2)} km` : label
    }
    const tag = item.route_tag ? ` · ${item.route_tag}` : ''
    return `${label} — ${(item.distance_m / 1000).toFixed(2)} km${tag}`
  }
  if (item.kind === 'hiit') return `HIIT — ${item.template_name}`
  const moves = new Set(item.entries.map((e) => e.move_name))
  return `Workout — ${moves.size} moves, ${item.entries.length} sets`
}

function confirmDelete(item: HistoryItem) {
  $q.dialog({
    title: 'Delete workout',
    message: 'Delete this workout everywhere (all devices, after their next sync)?',
    cancel: true,
  }).onOk(() => {
    if (item.kind === 'hiit') dataset.deleteHiitWorkout(item.started_at)
    else if (item.kind === 'run') dataset.deleteRunWorkout(item.started_at)
    else dataset.deleteWorkout(item.started_at)
  })
}

const runTagEditor = ref({ open: false, startedAt: 0, tag: '' })

function editRunTag(item: RunWorkout) {
  runTagEditor.value = { open: true, startedAt: item.started_at, tag: item.route_tag || '' }
}

function saveRunTag() {
  dataset.updateRunWorkout(runTagEditor.value.startedAt, { route_tag: runTagEditor.value.tag.trim() })
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '–:––'
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`
}

function formatSplit(seconds: number) {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const entryEditor = ref({ open: false, startedAt: 0, index: -1, reps: 0, weight: 0, duration: 0 })

function editEntry(item: Workout, index: number) {
  const e = item.entries[index]
  entryEditor.value = {
    open: true,
    startedAt: item.started_at,
    index,
    reps: e.reps,
    weight: e.weight,
    duration: e.duration_seconds || 0,
  }
}

function saveEntry() {
  const w = dataset.data.workouts.find((x) => x.started_at === entryEditor.value.startedAt)
  if (!w) return
  const entries = w.entries.map((e, i) =>
    i === entryEditor.value.index
      ? { ...e, reps: entryEditor.value.reps, weight: entryEditor.value.weight, duration_seconds: entryEditor.value.duration }
      : e,
  )
  dataset.updateWorkout(w.started_at, { entries })
}
</script>
