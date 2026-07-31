<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn flat dense icon="arrow_back" to="/admin" />
      <div class="text-h6">{{ username || `User #${userId}` }} — data (read-only)</div>
      <q-space />
      <q-select v-model="range" :options="ranges" option-label="label" dense outlined style="width: 160px" />
    </div>

    <q-banner v-if="error" dense class="bg-red-1 text-red-9 q-mb-md">{{ error }}</q-banner>
    <q-inner-loading :showing="loading" />

    <template v-if="!loading && !error">
      <div class="row q-gutter-sm q-mb-md">
        <q-chip icon="fitness_center" outline>{{ ds.workouts.length }} workouts</q-chip>
        <q-chip icon="timer" outline>{{ ds.hiit_workouts.length }} HIIT sessions</q-chip>
        <q-chip icon="event" outline>Last activity: {{ lastActivity }}</q-chip>
        <q-chip icon="monitor_weight" outline>{{ ds.body_weights.length }} weight entries</q-chip>
      </div>

      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-5">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2">Volume per week (kg)</div>
              <v-chart :option="volumeOption" autoresize style="height: 220px" />
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2">Sessions per week</div>
              <v-chart :option="frequencyOption" autoresize style="height: 220px" />
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-3">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2">Set composition</div>
              <v-chart :option="compositionOption" autoresize style="height: 220px" />
            </q-card-section>
          </q-card>
        </div>
        <div v-if="ds.body_weights.length >= 2" class="col-12 col-md-5">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-subtitle2">Body weight (kg)</div>
              <v-chart :option="bodyWeightOption" autoresize style="height: 220px" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-list bordered separator>
        <q-expansion-item v-for="item in history" :key="item.kind + item.started_at">
          <template #header>
            <q-item-section avatar>
              <q-icon :name="item.kind === 'hiit' ? 'timer' : 'fitness_center'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ headerFor(item) }}</q-item-label>
              <q-item-label caption>{{ new Date(item.started_at).toLocaleString() }}</q-item-label>
            </q-item-section>
          </template>
          <q-card v-if="item.kind === 'strength'">
            <q-card-section>
              <q-markup-table dense flat>
                <thead>
                  <tr><th class="text-left">Move</th><th>Set</th><th>Reps</th><th>Weight</th><th>Side</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(e, i) in item.entries" :key="i">
                    <td class="text-left">{{ e.move_name }}</td>
                    <td class="text-center">{{ e.set_no }}</td>
                    <td class="text-center">{{ e.reps }}</td>
                    <td class="text-center">{{ e.weight }}</td>
                    <td class="text-center">{{ e.side }}</td>
                  </tr>
                </tbody>
              </q-markup-table>
            </q-card-section>
          </q-card>
          <q-card v-else>
            <q-card-section class="text-caption">
              {{ item.template_name }} — {{ item.round_count }} rounds,
              work {{ Math.round(item.total_activity_seconds / 60) }} min,
              rest {{ Math.round(item.total_rest_seconds / 60) }} min
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { AxiosError } from 'axios'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { api } from '../api'
import { emptyDataset } from '../sync/contract'
import { weeklyVolume, weeklyFrequency, groupComposition, bodyWeightSeries } from '../charts'
import { gramsToKg } from '../weight'
import type { Dataset, HiitWorkout, Workout } from '../types'

type HistoryItem = (Workout & { kind: 'strength' }) | (HiitWorkout & { kind: 'hiit' })

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const BLUE = '#2a78d6'
const AQUA = '#1baf7a'
const YELLOW = '#eda100'

const route = useRoute()
const userId = route.params.id
const username = ref('')
const ds = ref(emptyDataset())
const loading = ref(true)
const error = ref('')

const ranges: Array<{ label: string; days: number | null }> = [
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: null },
]
const range = ref(ranges[2])
const sinceMs = computed(() => (range.value.days ? Date.now() - range.value.days * 86400000 : null))

onMounted(async () => {
  try {
    const [dataResp, usersResp] = await Promise.all([
      api.get<Dataset>(`/api/admin/users/${userId}/sync`),
      api.get<Array<{ id: number; username: string }>>('/api/admin/users'),
    ])
    ds.value = { ...emptyDataset(), ...dataResp.data }
    username.value = usersResp.data.find((u) => String(u.id) === String(userId))?.username || ''
  } catch (e) {
    const err = e as AxiosError
    error.value = err.response?.status === 404 ? 'No such user.' : err.message
  } finally {
    loading.value = false
  }
})

const history = computed<HistoryItem[]>(() =>
  [
    ...ds.value.workouts.map((w) => ({ ...w, kind: 'strength' as const })),
    ...ds.value.hiit_workouts.map((w) => ({ ...w, kind: 'hiit' as const })),
  ].sort((a, b) => b.started_at - a.started_at),
)

const lastActivity = computed(() =>
  history.value.length ? new Date(history.value[0].started_at).toLocaleDateString() : '—',
)

function headerFor(item: HistoryItem) {
  if (item.kind === 'hiit') return `HIIT — ${item.template_name}`
  const moves = new Set(item.entries.map((e) => e.move_name))
  return `Workout — ${moves.size} moves, ${item.entries.length} sets`
}

const axisStyle = {
  axisLine: { lineStyle: { color: '#9aa0a6' } },
  axisLabel: { color: '#5f6368' },
  splitLine: { lineStyle: { color: '#eceff1' } },
}

const volumeOption = computed(() => {
  const { labels, values } = weeklyVolume(ds.value.workouts, sinceMs.value, Date.now())
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [{ type: 'line', data: values, color: BLUE, lineStyle: { width: 2 }, symbolSize: 8, areaStyle: { opacity: 0.08 } }],
  }
})

const frequencyOption = computed(() => {
  const { labels, strength, hiit } = weeklyFrequency(ds.value.workouts, ds.value.hiit_workouts, sinceMs.value, Date.now())
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 36, right: 16, top: 16, bottom: 52 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle },
    series: [
      { name: 'Strength', type: 'bar', stack: 'total', data: strength, color: BLUE, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      { name: 'HIIT', type: 'bar', stack: 'total', data: hiit, color: AQUA, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    ],
  }
})

const compositionOption = computed(() => {
  const counts = groupComposition(ds.value.workouts, ds.value.moves, sinceMs.value)
  return {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      label: { show: true, formatter: '{b}: {c}', color: '#3c4043' },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      data: [
        { name: 'Legs', value: counts.LEGS, itemStyle: { color: BLUE } },
        { name: 'Push', value: counts.PUSH, itemStyle: { color: AQUA } },
        { name: 'Pull', value: counts.PULL, itemStyle: { color: YELLOW } },
      ],
    }],
  }
})

const bodyWeightOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 60, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: { type: 'value', scale: true, ...axisStyle },
  series: [{
    type: 'line',
    data: bodyWeightSeries(ds.value.body_weights, null).map(([t, g]) => [t, +gramsToKg(g).toFixed(1)]),
    color: BLUE,
    lineStyle: { width: 2 },
    symbolSize: 8,
  }],
}))
</script>
