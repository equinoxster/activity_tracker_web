<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-h6">Measurements</div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Body weight</div>
              <q-space />
              <q-btn-toggle
                v-model="unit" dense unelevated toggle-color="primary"
                :options="[{ label: 'kg', value: 'kg' }, { label: 'lb', value: 'lb' }]"
              />
            </div>
            <div
              class="row items-center q-mb-sm cursor-pointer"
              @click="weightEditorOpen = !weightEditorOpen"
            >
              <div>
                <div class="text-subtitle1">
                  {{ latestWeight ? `Your weight: ${formatWeight(latestWeight.grams, useKg)}` : 'Add your weight' }}
                </div>
                <div v-if="latestWeight" class="text-caption text-grey">{{ latestWeight.date }}</div>
              </div>
              <q-space />
              <q-icon name="edit" color="grey" size="18px" />
            </div>
            <div v-if="weightEditorOpen" class="row q-gutter-sm items-center q-mb-sm">
              <q-input v-model="weightInput" dense outlined :label="`Weight (${unit})`" style="width: 130px"
                @keyup.enter="addWeight" />
              <q-input v-model="weightDate" dense outlined type="date" style="width: 160px" />
              <q-btn color="primary" label="Save" @click="addWeight" />
            </div>
            <v-chart v-if="weightPairs.length >= 1" :option="bodyWeightOption" autoresize style="height: 220px" />
            <div v-if="weightRate !== null" class="text-caption q-mt-xs">
              Trend: {{ formatWeightRate(weightRate) }} per week (last 28 days)
            </div>
            <q-expansion-item v-if="weightHistory.length" dense :label="`History (${weightHistory.length})`">
              <q-list dense>
                <q-item v-for="entry in weightHistory" :key="entry.date">
                  <q-item-section>{{ entry.date }}</q-item-section>
                  <q-item-section>{{ formatWeight(entry.grams, useKg) }}</q-item-section>
                  <q-item-section side>
                    <q-btn flat dense round icon="delete" @click="removeWeight(entry)" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Height &amp; BMI</div>
              <q-space />
              <q-btn-toggle
                v-model="heightUnit" dense unelevated toggle-color="primary"
                :options="[{ label: 'cm', value: 'cm' }, { label: 'ft/in', value: 'ftin' }]"
              />
            </div>
            <div
              class="row items-center q-mb-sm cursor-pointer"
              @click="heightEditorOpen = !heightEditorOpen"
            >
              <div class="text-subtitle1">
                {{ heightCm ? `Your height: ${formatHeight(heightCm, useCm)}` : 'Add your height' }}
              </div>
              <q-space />
              <q-icon name="edit" color="grey" size="18px" />
            </div>
            <div v-if="heightEditorOpen" class="row q-gutter-sm items-center q-mb-sm">
              <template v-if="useCm">
                <q-input v-model="heightCmInput" dense outlined label="Height (cm)" style="width: 130px"
                  @keyup.enter="saveHeight" />
              </template>
              <template v-else>
                <q-input v-model="heightFeetInput" dense outlined label="ft" style="width: 90px" />
                <q-input v-model="heightInchesInput" dense outlined label="in" style="width: 90px" />
              </template>
              <q-btn color="primary" label="Save" @click="saveHeight" />
            </div>
            <q-separator class="q-mb-sm" />
            <div v-if="bmiValue !== null" class="text-h6">
              BMI {{ bmiValue.toFixed(1) }} · {{ bmiCategory(bmiValue) }}
            </div>
            <div v-else class="text-grey">Add weight and height to see BMI.</div>
            <v-chart v-if="bmiSeries.length >= 2" :option="bmiOption" autoresize style="height: 180px" />
            <div v-else-if="bmiValue !== null" class="text-caption text-grey q-mt-sm">
              Log more weight entries to see the BMI trend.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Blood pressure</div>
            <div class="row q-gutter-sm items-center q-mb-sm">
              <q-input v-model="bpDate" dense outlined type="date" style="width: 160px" />
              <q-btn-toggle
                v-model="bpSlot" dense unelevated toggle-color="primary"
                :options="[{ label: 'Morning', value: 'morning' }, { label: 'Evening', value: 'evening' }]"
              />
              <q-input v-model="bpSystolic" dense outlined label="Systolic" style="width: 110px" />
              <q-input v-model="bpDiastolic" dense outlined label="Diastolic" style="width: 110px" />
              <q-input v-model="bpPulse" dense outlined label="Pulse (optional)" style="width: 130px"
                @keyup.enter="addBloodPressure" />
              <q-btn color="primary" label="Save" @click="addBloodPressure" />
            </div>
            <v-chart v-if="bpSeries.labels.length >= 2" :option="bloodPressureOption" autoresize
              style="height: 240px" />
            <div v-if="bpBand !== null" class="text-caption q-mt-xs">
              {{ Math.round(bpBand) }}% of readings in the normal band (&lt;130/85)
            </div>
            <template v-if="bpWeeklyRows.length">
              <div class="text-caption text-weight-medium q-mt-md q-mb-xs">Weekly averages (AM / PM)</div>
              <v-chart v-if="bpWeeklyRows.length >= 2" :option="bpWeeklyOption" autoresize style="height: 220px" />
              <q-list dense>
                <q-item v-for="row in bpWeeklyRows.slice(0, 8)" :key="row.week" dense>
                  <q-item-section>{{ weekTitle(row.week) }}</q-item-section>
                  <q-item-section side>
                    {{ row.amSys !== null ? `AM ${row.amSys}/${row.amDia}` : 'AM —' }} ·
                    {{ row.pmSys !== null ? `PM ${row.pmSys}/${row.pmDia}` : 'PM —' }} · {{ row.n }}×
                  </q-item-section>
                </q-item>
              </q-list>
            </template>
            <q-expansion-item v-if="bpHistory.length" dense :label="`History (${bpHistory.length})`">
              <q-list dense>
                <q-item v-for="entry in bpHistory" :key="`${entry.date}|${entry.slot}`">
                  <q-item-section>{{ entry.date }} · {{ slotLabel(entry.slot) }}</q-item-section>
                  <q-item-section>
                    {{ entry.systolic }}/{{ entry.diastolic }}{{ entry.pulse ? `, pulse ${entry.pulse}` : '' }}
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat dense round icon="delete" @click="removeBloodPressure(entry)" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Circumference</div>
            <div class="row q-gutter-sm items-center q-mb-sm">
              <q-input v-model="girthDate" dense outlined type="date" style="width: 160px" />
              <q-input v-model="girthWaist" dense outlined :label="`Waist (${girthUnit})`" style="width: 120px" />
              <q-input v-model="girthChest" dense outlined :label="`Chest (${girthUnit})`" style="width: 120px"
                @keyup.enter="addGirths" />
              <q-btn color="primary" label="Save" @click="addGirths" />
            </div>
            <v-chart v-if="waistPairs.length + chestPairs.length >= 2" :option="girthOption" autoresize
              style="height: 220px" />
            <q-expansion-item v-if="girthHistory.length" dense :label="`History (${girthHistory.length})`">
              <q-list dense>
                <q-item v-for="entry in girthHistory" :key="`${entry.date}|${entry.kind}`">
                  <q-item-section>{{ entry.date }} · {{ entry.kind === 'waist' ? 'Waist' : 'Chest' }}</q-item-section>
                  <q-item-section>{{ formatGirth(entry.mm, useCm) }}</q-item-section>
                  <q-item-section side>
                    <q-btn flat dense round icon="delete" @click="removeGirth(entry)" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Weight vs waist (indexed)</div>
            <template v-if="weightWaist">
              <v-chart :option="weightWaistOption" autoresize style="height: 220px" />
              <div class="text-caption text-grey q-mt-xs">Both series start at 100 where they first overlap.</div>
            </template>
            <div v-else class="text-caption text-grey">
              Log overlapping weight and waist entries to compare the trends.
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useDatasetStore } from '../stores/dataset'
import { WEIGHT_UNIT_KEY, HEIGHT_UNIT_KEY } from '../api'
import { gramsToKg, gramsToLb, parseToGrams, formatWeight } from '../weight'
import { bmi, bmiCategory, cmToFeetInches, feetInchesToCm, formatHeight } from '../height'
import { bodyWeightSeries, bloodPressureSeries, girthSeries } from '../charts'
import {
  rollingWeight,
  weightSlopePerWeek,
  indexedPair,
  bpWeekly,
  bpNormalShare,
  bpPulseSeries,
  bmiTrend,
} from '../statsCalc'
import { formatGirth, parseToMm } from '../girth'
import type { BloodPressure, BloodPressureSlot, BodyGirth, BodyWeight } from '../types'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const dataset = useDatasetStore()
const $q = useQuasar()

// Validated categorical slots (dataviz palette, light mode).
const AQUA = '#1baf7a'
const RED = '#d64545'
const BLUE = '#2a78d6'
const YELLOW = '#eda100'

const axisStyle = {
  axisLine: { lineStyle: { color: '#8a8f98' } },
  splitLine: { lineStyle: { color: '#e8eaed' } },
}

// ── body weight (moved from StatsPage) ──
const unit = ref(localStorage.getItem(WEIGHT_UNIT_KEY) === 'lb' ? 'lb' : 'kg')
watch(unit, (u) => localStorage.setItem(WEIGHT_UNIT_KEY, u))
const useKg = computed(() => unit.value === 'kg')

const weightEditorOpen = ref(false)
const latestWeight = computed(() => {
  const sorted = [...dataset.data.body_weights].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.length ? sorted[sorted.length - 1]! : null
})
const weightInput = ref('')
const weightDate = ref(new Date().toISOString().slice(0, 10))

function addWeight() {
  const grams = parseToGrams(weightInput.value, useKg.value)
  if (!grams || !weightDate.value) return
  dataset.upsertBodyWeight(weightDate.value, grams)
  weightInput.value = ''
  weightEditorOpen.value = false
}

function removeWeight(entry: BodyWeight) {
  $q.dialog({
    title: 'Delete entry?',
    message: `Remove the weight logged on ${entry.date}?`,
    cancel: true,
  }).onOk(() => dataset.deleteBodyWeight(entry.date))
}

const weightPairs = computed(() => bodyWeightSeries(dataset.data.body_weights, 0))
const weightHistory = computed(() =>
  [...dataset.data.body_weights].sort((a, b) => (a.date < b.date ? 1 : -1)))

const areaGradient = (hex: string) => ({
  type: 'linear' as const,
  x: 0, y: 0, x2: 0, y2: 1,
  colorStops: [
    { offset: 0, color: `${hex}55` },
    { offset: 1, color: `${hex}00` },
  ],
})

const toDisplayWeight = (g: number) => +(useKg.value ? gramsToKg(g) : gramsToLb(g)).toFixed(1)

const rollingPairs = computed(() => rollingWeight(dataset.data.body_weights))

const bodyWeightOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    formatter: (params: Array<{ seriesName: string; value: [number, number] }>) => {
      const [t] = params[0]!.value
      const rows = params.map((p) => `${p.seriesName}: ${p.value[1]} ${unit.value}`).join('<br/>')
      return `${new Date(t).toLocaleDateString()}<br/>${rows}`
    },
  },
  legend: { data: ['Weight', '7-day avg'], bottom: 0 },
  grid: { left: 60, right: 16, top: 16, bottom: 52 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: { type: 'value', scale: true, ...axisStyle },
  series: [
    {
      name: 'Weight',
      type: 'line',
      smooth: true,
      data: weightPairs.value.map(([t, g]) => [t, toDisplayWeight(g)]),
      color: AQUA,
      lineStyle: { width: 2 },
      symbolSize: 8,
      areaStyle: { color: areaGradient(AQUA) },
      markPoint: {
        symbolSize: 44,
        label: { fontSize: 10 },
        data: [
          { type: 'min', name: 'Min' },
          { type: 'max', name: 'Max' },
        ],
      },
    },
    {
      name: '7-day avg',
      type: 'line',
      smooth: true,
      data: rollingPairs.value.map(([t, g]) => [t, toDisplayWeight(g)]),
      color: BLUE,
      lineStyle: { width: 2, type: 'dashed' },
      symbol: 'none',
    },
  ],
}))

// Least-squares slope over the last 28 days, in grams/week (display converts).
const weightRate = computed(() => weightSlopePerWeek(dataset.data.body_weights, Date.now()))

function formatWeightRate(gramsPerWeek: number): string {
  const value = useKg.value ? gramsPerWeek / 1000 : gramsToLb(gramsPerWeek)
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(2)} ${unit.value}`
}

// ── height & BMI ──
const heightUnit = ref(localStorage.getItem(HEIGHT_UNIT_KEY) === 'ftin' ? 'ftin' : 'cm')
watch(heightUnit, (u) => localStorage.setItem(HEIGHT_UNIT_KEY, u))
const useCm = computed(() => heightUnit.value === 'cm')

const heightCm = computed(() => dataset.data.profile?.height_cm ?? null)
const heightEditorOpen = ref(false)
const heightCmInput = ref('')
const heightFeetInput = ref('')
const heightInchesInput = ref('')

watch(heightCm, (cm) => {
  heightCmInput.value = cm ? String(cm) : ''
  const parts = cm ? cmToFeetInches(cm) : null
  heightFeetInput.value = parts ? String(parts.feet) : ''
  heightInchesInput.value = parts ? String(parts.inches) : ''
}, { immediate: true })

function saveHeight() {
  let cm: number | null = null
  if (useCm.value) {
    const raw = heightCmInput.value.trim()
    if (raw) {
      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 50 || parsed > 272) return
      cm = parsed
    }
  } else {
    const feet = Number(heightFeetInput.value.trim())
    const inches = Number(heightInchesInput.value.trim() || '0')
    if (heightFeetInput.value.trim() || heightInchesInput.value.trim()) {
      if (!Number.isInteger(feet) || feet < 1 || feet > 8) return
      if (!Number.isInteger(inches) || inches < 0 || inches > 11) return
      cm = feetInchesToCm(feet, inches)
    }
  }
  dataset.setProfileHeight(cm)
  heightEditorOpen.value = false
}

const bmiValue = computed(() => {
  const weights = dataset.data.body_weights
  const latest = weights.length ? [...weights].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1) : null
  if (!latest || !heightCm.value) return null
  return bmi(latest.grams, heightCm.value)
})

const bmiSeries = computed(() => bmiTrend(dataset.data.body_weights, heightCm.value))

const bmiOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 44, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: { type: 'value', scale: true, ...axisStyle },
  series: [{
    type: 'line',
    smooth: true,
    data: bmiSeries.value,
    color: AQUA,
    lineStyle: { width: 2 },
    symbolSize: 8,
    areaStyle: { color: areaGradient(AQUA) },
  }],
}))

// ── blood pressure ──
const bpDate = ref(new Date().toISOString().slice(0, 10))
const bpSlot = ref<BloodPressureSlot>(new Date().getHours() < 12 ? 'morning' : 'evening')
const bpSystolic = ref('')
const bpDiastolic = ref('')
const bpPulse = ref('')

function addBloodPressure() {
  const systolic = Number(bpSystolic.value.trim())
  const diastolic = Number(bpDiastolic.value.trim())
  const pulseRaw = bpPulse.value.trim()
  const pulse = pulseRaw ? Number(pulseRaw) : null
  if (!Number.isInteger(systolic) || systolic <= 0) return
  if (!Number.isInteger(diastolic) || diastolic <= 0) return
  if (pulseRaw && (pulse === null || !Number.isInteger(pulse) || pulse <= 0)) return
  if (!bpDate.value) return
  dataset.upsertBloodPressure(bpDate.value, bpSlot.value, systolic, diastolic, pulse)
  bpSystolic.value = ''
  bpDiastolic.value = ''
  bpPulse.value = ''
}

function removeBloodPressure(entry: BloodPressure) {
  $q.dialog({
    title: 'Delete reading?',
    message: `Remove the ${entry.slot} reading from ${entry.date}?`,
    cancel: true,
  }).onOk(() => dataset.deleteBloodPressure(entry.date, entry.slot))
}

const slotLabel = (slot: string) => (slot === 'morning' ? 'Morning' : 'Evening')

// ── circumference ──
const girthDate = ref(new Date().toISOString().slice(0, 10))
const girthWaist = ref('')
const girthChest = ref('')
const girthUnit = computed(() => (useCm.value ? 'cm' : 'in'))

function addGirths() {
  if (!girthDate.value) return
  const waistMm = girthWaist.value.trim() ? parseToMm(girthWaist.value, useCm.value) : null
  const chestMm = girthChest.value.trim() ? parseToMm(girthChest.value, useCm.value) : null
  if (girthWaist.value.trim() && waistMm === null) return
  if (girthChest.value.trim() && chestMm === null) return
  if (waistMm === null && chestMm === null) return
  if (waistMm !== null) dataset.upsertBodyGirth(girthDate.value, 'waist', waistMm)
  if (chestMm !== null) dataset.upsertBodyGirth(girthDate.value, 'chest', chestMm)
  girthWaist.value = ''
  girthChest.value = ''
}

function removeGirth(entry: BodyGirth) {
  $q.dialog({
    title: 'Delete measurement?',
    message: `Remove the ${entry.kind} measurement from ${entry.date}?`,
    cancel: true,
  }).onOk(() => dataset.deleteBodyGirth(entry.date, entry.kind))
}

const waistPairs = computed(() => girthSeries(dataset.data.body_girths, 'waist'))
const chestPairs = computed(() => girthSeries(dataset.data.body_girths, 'chest'))
const girthHistory = computed(() =>
  [...dataset.data.body_girths].sort(
    (a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind),
  ))

// ── weight vs waist, indexed to 100 at the overlap start (no dual axes) ──
const weightWaist = computed(() => indexedPair(weightPairs.value, waistPairs.value))

const weightWaistOption = computed(() => {
  const pair = weightWaist.value
  const round = (points: Array<[number, number]>) => points.map(([t, v]) => [t, +v.toFixed(1)])
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Weight', 'Waist'] },
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
    xAxis: { type: 'time', ...axisStyle },
    yAxis: { type: 'value', scale: true, ...axisStyle },
    series: [
      {
        name: 'Weight', type: 'line', smooth: true, data: pair ? round(pair.a) : [],
        color: AQUA, lineStyle: { width: 2 }, symbolSize: 8,
      },
      {
        name: 'Waist', type: 'line', smooth: true, data: pair ? round(pair.b) : [],
        color: RED, lineStyle: { width: 2 }, symbolSize: 8,
      },
    ],
  }
})

const girthOption = computed(() => {
  const toDisplay = ([t, mm]: [number, number]) =>
    [t, +(useCm.value ? mm / 10 : mm / 25.4).toFixed(1)]
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Waist', 'Chest'] },
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
    xAxis: { type: 'time', ...axisStyle },
    yAxis: { type: 'value', scale: true, ...axisStyle },
    series: [
      {
        name: 'Waist', type: 'line', smooth: true, data: waistPairs.value.map(toDisplay),
        color: RED, lineStyle: { width: 2 }, symbolSize: 8, areaStyle: { color: areaGradient(RED) },
      },
      {
        name: 'Chest', type: 'line', smooth: true, data: chestPairs.value.map(toDisplay),
        color: BLUE, lineStyle: { width: 2 }, symbolSize: 8, areaStyle: { color: areaGradient(BLUE) },
      },
    ],
  }
})

const bpSeries = computed(() => bloodPressureSeries(dataset.data.blood_pressures, 0))
const bpHistory = computed(() =>
  [...dataset.data.blood_pressures].sort(
    (a, b) => b.date.localeCompare(a.date) || (a.slot === 'morning' ? 1 : -1) - (b.slot === 'morning' ? 1 : -1),
  ))

const bpPulseLine = computed(() => bpPulseSeries(dataset.data.blood_pressures))

const bloodPressureOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['Systolic', 'Diastolic', 'Pulse'] },
  grid: { left: 48, right: 16, top: 40, bottom: 28 },
  xAxis: { type: 'category', data: bpSeries.value.labels, ...axisStyle },
  yAxis: { type: 'value', scale: true, ...axisStyle },
  series: [
    { name: 'Systolic', type: 'line', data: bpSeries.value.systolic, color: RED, lineStyle: { width: 2 }, symbolSize: 8 },
    { name: 'Diastolic', type: 'line', data: bpSeries.value.diastolic, color: BLUE, lineStyle: { width: 2 }, symbolSize: 8 },
    { name: 'Pulse', type: 'line', data: bpPulseLine.value.pulse, color: YELLOW, lineStyle: { width: 2 }, symbolSize: 8 },
  ],
}))

// ── BP weekly averages / normal band ──
const bpWeeklyRows = computed(() => bpWeekly(dataset.data.blood_pressures))
const bpBand = computed(() => bpNormalShare(dataset.data.blood_pressures))

const weekTitle = (week: string) => {
  const n = Number(week.split('-W')[1])
  return Number.isFinite(n) ? `Week ${n}` : week
}

const bpWeeklyOption = computed(() => {
  const rows = [...bpWeeklyRows.value].reverse() // oldest → newest for the axis
  const line = (name: string, data: Array<number | null>, color: string, dashed: boolean) => ({
    name,
    type: 'line',
    data,
    color,
    lineStyle: { width: 2, type: dashed ? 'dashed' : 'solid' },
    symbolSize: 6,
    connectNulls: true,
  })
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['AM systolic', 'PM systolic', 'AM diastolic', 'PM diastolic'] },
    grid: { left: 48, right: 16, top: 40, bottom: 28 },
    xAxis: { type: 'category', data: rows.map((r) => weekTitle(r.week)), ...axisStyle },
    yAxis: { type: 'value', scale: true, ...axisStyle },
    series: [
      line('AM systolic', rows.map((r) => r.amSys), RED, false),
      line('PM systolic', rows.map((r) => r.pmSys), RED, true),
      line('AM diastolic', rows.map((r) => r.amDia), BLUE, false),
      line('PM diastolic', rows.map((r) => r.pmDia), BLUE, true),
    ],
  }
})
</script>
