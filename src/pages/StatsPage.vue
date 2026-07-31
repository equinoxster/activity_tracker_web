<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-h6">Statistics</div>
      <q-space />
      <q-select v-model="range" :options="ranges" option-label="label" dense outlined style="width: 160px" />
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Training volume per week (kg lifted)</div>
            <v-chart :option="volumeOption" autoresize style="height: 260px" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center">
              <div class="text-subtitle2">Move progression</div>
              <q-space />
              <q-select v-model="selectedMove" :options="moveOptions" dense outlined style="width: 180px" />
            </div>
            <v-chart :option="progressionOption" autoresize style="height: 240px" />
            <div v-if="selectedMovePrs" class="text-caption q-mt-sm">
              All-time PRs: {{ selectedMovePrs.maxWeight }} kg top set ·
              {{ selectedMovePrs.bestE1rm !== null ? selectedMovePrs.bestE1rm.toFixed(1) + ' kg e1RM' : 'no e1RM sets' }} ·
              {{ Math.round(selectedMovePrs.maxSessionVolume) }} kg best session volume
            </div>
            <template v-if="selectedMoveUnilateral">
              <div class="text-caption text-weight-medium q-mt-md">Left−right imbalance (%)</div>
              <v-chart v-if="asymmetryPoints.length" :option="asymmetryOption" autoresize style="height: 160px" />
              <div v-else class="text-caption text-grey">Log left and right sets to see the imbalance trend.</div>
            </template>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Recent PRs</div>
            <q-list v-if="recentPrEvents.length" dense>
              <q-item v-for="(pr, i) in recentPrEvents" :key="i" dense>
                <q-item-section>{{ new Date(pr.date).toLocaleDateString() }} · {{ pr.moveName }}</q-item-section>
                <q-item-section side>
                  {{ pr.kind === 'weight' ? pr.value + ' kg top set' : pr.value.toFixed(1) + ' kg e1RM' }}
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-caption text-grey">PRs appear once you log weighted sets.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Balance</div>
            <template v-if="hasTonnage">
              <div class="q-mb-sm">
                Push:pull ratio —
                <b v-if="pushPull !== null">{{ pushPull.toFixed(2) }} : 1</b>
                <span v-else class="text-grey">needs pull tonnage</span>
              </div>
              <div class="row">
                <div class="col-6">
                  <q-list dense>
                    <q-item v-for="g in ['PUSH', 'PULL', 'LEGS']" :key="g" dense>
                      <q-item-section>{{ g }}</q-item-section>
                      <q-item-section side>{{ Math.round(groupTonnage[g] || 0).toLocaleString() }} kg</q-item-section>
                    </q-item>
                  </q-list>
                </div>
                <div class="col-6">
                  <q-list dense>
                    <q-item v-for="h in ['UPPER', 'LOWER', 'CORE']" :key="h" dense>
                      <q-item-section>{{ h }}</q-item-section>
                      <q-item-section side>{{ Math.round(heightTonnage[h] || 0).toLocaleString() }} kg</q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </div>
            </template>
            <div v-else class="text-caption text-grey">No weighted sets in this range.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Rep ranges (sets)</div>
            <v-chart v-if="hasRepRanges" :option="repRangeOption" autoresize style="height: 220px" />
            <div v-else class="text-caption text-grey q-mt-sm">No weighted sets in this range.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Rest &amp; density</div>
            <template v-if="rest.medianRestS !== null || rest.setsPerHour !== null">
              <div class="q-mb-xs">
                Median rest: <b>{{ rest.medianRestS !== null ? formatRunTime(rest.medianRestS) : '—' }}</b>
              </div>
              <div>Sets per hour: <b>{{ rest.setsPerHour !== null ? rest.setsPerHour.toFixed(1) : '—' }}</b></div>
              <div class="text-caption text-grey q-mt-sm">Gaps of 15 min or more are ignored.</div>
            </template>
            <div v-else class="text-caption text-grey">No timed sets in this range.</div>
          </q-card-section>
        </q-card>
      </div>

      <div v-if="adherence" class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Regime adherence</div>
            <div class="q-mb-xs">
              Fulfilled <b>{{ adherence.fulfilled }}</b> of <b>{{ adherence.planned }}</b> planned slots
              <b v-if="adherence.percent !== null">({{ Math.round(adherence.percent) }}%)</b>
            </div>
            <div class="q-mb-xs">
              Average slip:
              <b>{{ adherence.avgSlipDays !== null ? formatSlip(adherence.avgSlipDays) : '—' }}</b>
            </div>
            <div>Loops completed: <b>{{ adherence.completedLoops }}</b></div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Year in numbers · {{ yearStats.year }}</div>
            <template v-if="yearHasData">
              <div class="row text-center">
                <div class="col-4">
                  <div class="text-h6">{{ yearStats.strengthSessions + yearStats.hiitSessions + yearStats.runSessions }}</div>
                  <div class="text-caption text-grey">sessions</div>
                </div>
                <div class="col-4">
                  <div class="text-h6">{{ yearStats.totalHours }}</div>
                  <div class="text-caption text-grey">hours</div>
                </div>
                <div class="col-4">
                  <div class="text-h6">{{ yearStats.prCount }}</div>
                  <div class="text-caption text-grey">PRs</div>
                </div>
              </div>
              <q-separator class="q-my-sm" />
              <div class="text-caption">
                {{ yearStats.strengthSessions }} strength · {{ yearStats.hiitSessions }} HIIT ·
                {{ yearStats.runSessions }} runs · {{ yearStats.tonnage.toLocaleString() }} kg lifted ·
                {{ yearStats.runKm }} km covered
              </div>
            </template>
            <div v-else class="text-caption text-grey">No activity logged in {{ yearStats.year }} yet.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Habits</div>
            <template v-if="hasAnySession">
              <div class="q-mb-sm">
                Current streak: <b>{{ habitStreaks.current }}</b> {{ habitStreaks.current === 1 ? 'day' : 'days' }} ·
                Longest: <b>{{ habitStreaks.longest }}</b> {{ habitStreaks.longest === 1 ? 'day' : 'days' }}
              </div>
              <div style="overflow-x: auto" class="q-mb-md">
                <div style="display: grid; grid-template-rows: repeat(7, 12px); grid-auto-flow: column; grid-auto-columns: 12px; gap: 2px">
                  <template v-for="(week, wi) in heatmap" :key="wi">
                    <div
                      v-for="cell in week"
                      :key="cell.date"
                      :title="`${cell.date}: ${cell.count}`"
                      :style="`border-radius: 2px; background: ${heatColor(cell.count)}`"
                    ></div>
                  </template>
                </div>
                <div class="text-caption text-grey q-mt-xs">Last 26 weeks, Mon–Sun; darker = more sessions.</div>
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <div class="text-caption text-weight-medium">Sessions by weekday</div>
                  <v-chart :option="weekdayOption" autoresize style="height: 180px" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="text-caption text-weight-medium">Sessions by start hour</div>
                  <v-chart :option="hourOption" autoresize style="height: 180px" />
                </div>
              </div>
            </template>
            <div v-else class="text-caption text-grey">Habits appear after your first finished workout.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Neglect</div>
            <template v-if="hasAnyStrength">
              <q-list dense class="q-mb-sm">
                <q-item v-for="g in groupNeglect" :key="g.group" dense>
                  <q-item-section>{{ g.group }}</q-item-section>
                  <q-item-section side>
                    {{ g.daysSince === null ? 'never trained' : g.daysSince === 0 ? 'today' : `${g.daysSince} d ago` }}
                  </q-item-section>
                </q-item>
              </q-list>
              <div class="text-caption text-weight-medium q-mb-xs">Stale moves (30+ days)</div>
              <q-list v-if="staleMoves.length" dense>
                <q-item v-for="m in staleMoves" :key="m.name" dense>
                  <q-item-section>{{ m.name }}</q-item-section>
                  <q-item-section side>{{ m.daysSince === null ? 'never' : `${m.daysSince} d` }}</q-item-section>
                </q-item>
              </q-list>
              <div v-else class="text-caption text-grey">No enabled move is stale. Nice.</div>
            </template>
            <div v-else class="text-caption text-grey">Neglect tracking appears after your first strength workout.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Weekly activity minutes</div>
            <v-chart v-if="activityMinutes.labels.length" :option="activityMinutesOption" autoresize style="height: 260px" />
            <div v-else class="text-caption text-grey q-mt-sm">No activity in this range.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Sessions per week</div>
            <v-chart :option="frequencyOption" autoresize style="height: 260px" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Set composition by group</div>
            <v-chart :option="compositionOption" autoresize style="height: 260px" />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-3">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">HIIT minutes per week</div>
            <v-chart :option="hiitOption" autoresize style="height: 220px" />
            <div v-if="longestHiitSession" class="text-caption q-mt-xs">
              Longest session: {{ formatRunTime(longestHiitSession.durationS) }}
              ({{ new Date(longestHiitSession.startedAt).toLocaleDateString() }})
            </div>
            <q-list v-if="hiitMoveSeconds.length" dense class="q-mt-xs">
              <q-item v-for="row in hiitMoveSeconds" :key="row.moveName" dense>
                <q-item-section>{{ row.moveName }}</q-item-section>
                <q-item-section side>{{ Math.round(row.workS / 60) }} min work</q-item-section>
              </q-item>
            </q-list>
            <div v-if="!longestHiitSession" class="text-caption text-grey q-mt-sm">No HIIT sessions yet.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Run distance per week (km)</div>
            <v-chart :option="runDistanceOption" autoresize style="height: 260px" />
            <q-list v-if="runBreakdown.length" dense class="q-mt-sm">
              <q-item v-for="row in runBreakdown" :key="row.activity" dense>
                <q-item-section>{{ activityLabel(row.activity) }}</q-item-section>
                <q-item-section side>
                  {{ row.count }} · {{ row.distanceKm > 0 ? row.distanceKm.toFixed(1) + ' km' : '—' }} ·
                  {{ formatBreakdownDuration(row.durationS) }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Route progression</div>
              <q-space />
              <q-select
                v-model="selectedRoute" :options="routeOptions" dense outlined clearable
                label="Route" style="width: 180px"
              />
            </div>
            <template v-if="attempts.length">
              <!-- bestAttempt is non-null whenever attempts is non-empty. -->
              <div class="text-caption q-mb-sm">
                {{ attempts.length }} attempts ·
                best {{ formatRunTime(bestAttempt!.duration_s) }}
                ({{ new Date(bestAttempt!.started_at).toLocaleDateString() }})
              </div>
              <v-chart v-if="attempts.length >= 2" :option="routeOption" autoresize style="height: 200px" />
              <q-markup-table dense flat>
                <thead>
                  <tr><th class="text-left">Date</th><th class="text-left">Time</th><th class="text-left">Pace</th></tr>
                </thead>
                <tbody>
                  <tr v-for="a in [...attempts].reverse()" :key="a.started_at"
                      :class="a.started_at === bestAttempt!.started_at ? 'text-positive' : ''">
                    <td>{{ new Date(a.started_at).toLocaleDateString() }}</td>
                    <td>{{ formatRunTime(a.duration_s) }}</td>
                    <td>{{ formatRunPace(a.avg_pace_s_per_km) }}</td>
                  </tr>
                </tbody>
              </q-markup-table>
            </template>
            <div v-else class="text-caption text-grey">Tag runs with a route name to compare attempts.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Pace trend</div>
              <q-space />
              <q-select
                v-model="selectedActivity" :options="activityOptions" dense outlined
                :option-label="activityLabel" style="width: 160px"
              />
            </div>
            <v-chart v-if="pacePoints.length" :option="paceOption" autoresize style="height: 220px" />
            <div v-else class="text-caption text-grey">Log runs with a distance to see the pace trend.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Run records &amp; milestones</div>
            <q-list v-if="runRecords.length" dense class="q-mb-sm">
              <q-item v-for="r in runRecords" :key="r.distance_km" dense>
                <q-item-section>Best {{ r.distance_km }} km</q-item-section>
                <q-item-section side>
                  {{ formatRecordTime(r.seconds) }} · {{ new Date(r.run_started_at).toLocaleDateString() }}
                </q-item-section>
              </q-item>
            </q-list>
            <template v-if="dataset.data.run_workouts.length">
              <q-list dense>
                <q-item dense>
                  <q-item-section>Fastest km</q-item-section>
                  <q-item-section side>
                    {{ bestKm ? `${formatRunTime(bestKm.seconds)} (${new Date(bestKm.startedAt).toLocaleDateString()})` : 'needs km splits' }}
                  </q-item-section>
                </q-item>
                <q-item dense>
                  <q-item-section>Longest run</q-item-section>
                  <q-item-section side>
                    {{ maxRun ? `${maxRun.km} km (${new Date(maxRun.startedAt).toLocaleDateString()})` : 'needs a distance' }}
                  </q-item-section>
                </q-item>
                <q-item dense>
                  <q-item-section>Negative splits</q-item-section>
                  <q-item-section side>
                    {{ negSplits.sharePct !== null
                      ? `${negSplits.negative} of ${negSplits.eligible} runs (${Math.round(negSplits.sharePct)}%)`
                      : 'needs 2+ km splits' }}
                  </q-item-section>
                </q-item>
                <q-item dense>
                  <q-item-section>Treadmill share</q-item-section>
                  <q-item-section side>
                    {{ treadmill.totalCount
                      ? `${treadmill.count} of ${treadmill.totalCount} · ${treadmill.km} of ${treadmill.totalKm} km`
                      : '—' }}
                  </q-item-section>
                </q-item>
              </q-list>
              <q-separator class="q-my-sm" />
              <div class="text-caption text-weight-medium q-mb-xs">Milestones</div>
              <q-list dense>
                <q-item v-for="m in milestones" :key="m.activity" dense>
                  <q-item-section>{{ activityLabel(m.activity) }}</q-item-section>
                  <q-item-section side>{{ m.yearKm }} km this year · {{ m.allTimeKm }} km all-time</q-item-section>
                </q-item>
              </q-list>
            </template>
            <div v-else class="text-caption text-grey">Records appear after your first run.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2">Pace zones (minutes per km pace)</div>
            <v-chart v-if="hasPaceZones" :option="paceZoneOption" autoresize style="height: 220px" />
            <div v-else class="text-caption text-grey q-mt-sm">Pace zones need runs with km splits in this range.</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Route heatmap</div>
            <q-expansion-item v-if="heatmapRoutes.length" dense :label="`Show map (${heatmapRoutes.length} routes)`">
              <RouteHeatmap :routes="heatmapRoutes" />
            </q-expansion-item>
            <div v-else class="text-caption text-grey">GPS-tracked runs show up here as overlaid routes.</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useDatasetStore } from '../stores/dataset'
import RouteHeatmap from '../components/RouteHeatmap.vue'
import {
  weeklyVolume,
  moveProgression,
  moveNamesInHistory,
  weeklyFrequency,
  groupComposition,
  hiitWorkRest,
  weeklyRunDistance,
  activityBreakdown,
  routeAttempts,
  routeTags,
} from '../charts'
import {
  e1rmTrend,
  movePRs,
  recentPRs,
  asymmetryTrend,
  tonnageByGroup,
  tonnageByHeight,
  pushPullRatio,
  repRangeDistribution,
  restStats,
  activeDayCounts,
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
  weeklyActivityMinutes,
  yearInNumbers,
  localIsoDate,
} from '../statsCalc'
import type { RunPoint } from '../types'

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const dataset = useDatasetStore()

// Validated categorical slots (dataviz palette, light mode).
const BLUE = '#2a78d6'
const AQUA = '#1baf7a'
const YELLOW = '#eda100'

const ranges: Array<{ label: string; days: number | null }> = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: null },
]
const range = ref(ranges[1])
const sinceMs = computed(() => (range.value.days ? Date.now() - range.value.days * 86400000 : null))

const moveOptions = computed(() => moveNamesInHistory(dataset.data.workouts))
const selectedMove = ref<string | null>(null)
watch(moveOptions, (opts) => {
  if (!selectedMove.value && opts.length) selectedMove.value = opts[0]
}, { immediate: true })

const axisStyle = {
  axisLine: { lineStyle: { color: '#9aa0a6' } },
  axisLabel: { color: '#5f6368' },
  splitLine: { lineStyle: { color: '#eceff1' } },
}

const volumeOption = computed(() => {
  const { labels, values } = weeklyVolume(dataset.data.workouts, sinceMs.value, Date.now())
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [{ type: 'line', data: values, color: BLUE, lineStyle: { width: 2 }, symbolSize: 8, areaStyle: { opacity: 0.08 } }],
  }
})

// ── move progression + e1RM / PRs / asymmetry ──
const progressionOption = computed(() => {
  const points = selectedMove.value ? moveProgression(dataset.data.workouts, selectedMove.value, sinceMs.value) : []
  const e1rm = selectedMove.value
    ? e1rmTrend(dataset.data.workouts, selectedMove.value).filter(([t]) => !sinceMs.value || t >= sinceMs.value)
    : []
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 48, right: 16, top: 16, bottom: 52 },
    xAxis: { type: 'time', ...axisStyle },
    yAxis: { type: 'value', name: 'kg', ...axisStyle },
    series: [
      { name: 'Max weight', type: 'line', data: points, color: BLUE, lineStyle: { width: 2 }, symbolSize: 8 },
      {
        name: 'Best e1RM',
        type: 'line',
        data: e1rm.map(([t, v]) => [t, +v.toFixed(1)]),
        color: AQUA,
        lineStyle: { width: 2 },
        symbolSize: 8,
      },
    ],
  }
})

const selectedMovePrs = computed(() =>
  selectedMove.value ? movePRs(dataset.data.workouts, selectedMove.value) : null)

const selectedMoveUnilateral = computed(() => {
  const name = selectedMove.value?.toLowerCase()
  if (!name) return false
  return dataset.data.moves.some((m) => m.name.toLowerCase() === name && m.laterality === 'UNILATERAL')
})

const asymmetryPoints = computed(() =>
  selectedMove.value ? asymmetryTrend(dataset.data.workouts, selectedMove.value) : [])

const asymmetryOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 48, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: { type: 'value', name: '%', ...axisStyle },
  series: [{
    type: 'line',
    data: asymmetryPoints.value.map(([t, v]) => [t, +(v * 100).toFixed(1)]),
    color: YELLOW,
    lineStyle: { width: 2 },
    symbolSize: 8,
  }],
}))

const recentPrEvents = computed(() => recentPRs(dataset.data.workouts))

// ── balance / rep ranges / rest ──
const groupTonnage = computed(() => tonnageByGroup(dataset.data.workouts, dataset.data.moves, sinceMs.value))
const heightTonnage = computed(() => tonnageByHeight(dataset.data.workouts, dataset.data.moves, sinceMs.value))
const pushPull = computed(() => pushPullRatio(dataset.data.workouts, dataset.data.moves, sinceMs.value))
const hasTonnage = computed(() => Object.values(groupTonnage.value).some((v) => v > 0))

const repRanges = computed(() => repRangeDistribution(dataset.data.workouts, sinceMs.value))
const hasRepRanges = computed(() => {
  const r = repRanges.value
  return r.strength + r.hypertrophy + r.endurance > 0
})

const repRangeOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'category', data: ['1–5', '6–12', '13+'], ...axisStyle },
  yAxis: { type: 'value', minInterval: 1, ...axisStyle },
  series: [{
    type: 'bar',
    data: [repRanges.value.strength, repRanges.value.hypertrophy, repRanges.value.endurance],
    color: BLUE,
    itemStyle: { borderColor: '#fff', borderWidth: 1, borderRadius: [4, 4, 0, 0] },
  }],
}))

const rest = computed(() => restStats(dataset.data.workouts, sinceMs.value))

// ── regime adherence ──
const adherence = computed(() => regimeAdherence(dataset.data.active_regime, Date.now()))

const formatSlip = (days: number) => `${days >= 0 ? '+' : '−'}${Math.abs(days).toFixed(1)} d`

// ── habits ──
const dayCounts = computed(() =>
  activeDayCounts(dataset.data.workouts, dataset.data.hiit_workouts, dataset.data.run_workouts))
const hasAnySession = computed(() => dayCounts.value.size > 0)
const habitStreaks = computed(() => streaks(new Set(dayCounts.value.keys()), localIsoDate(Date.now())))
const heatmap = computed(() => heatmapWeeks(dayCounts.value, Date.now()))

// Sequential single-hue ramp (aqua, light → dark) for day intensity.
const HEAT_COLORS = ['#edf0f2', '#b8e4d2', '#6fccaa', '#1baf7a', '#0e7a54']
const heatColor = (count: number) => HEAT_COLORS[Math.min(count, HEAT_COLORS.length - 1)]

const weekdayOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 36, right: 16, top: 8, bottom: 24 },
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ...axisStyle },
  yAxis: { type: 'value', minInterval: 1, ...axisStyle },
  series: [{
    type: 'bar',
    data: weekdayHistogram(dataset.data.workouts, dataset.data.hiit_workouts, dataset.data.run_workouts),
    color: BLUE,
    itemStyle: { borderColor: '#fff', borderWidth: 1, borderRadius: [4, 4, 0, 0] },
  }],
}))

const hourOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 36, right: 16, top: 8, bottom: 24 },
  xAxis: { type: 'category', data: [...Array(24).keys()].map(String), ...axisStyle },
  yAxis: { type: 'value', minInterval: 1, ...axisStyle },
  series: [{
    type: 'bar',
    data: startHourHistogram(dataset.data.workouts, dataset.data.hiit_workouts, dataset.data.run_workouts),
    color: BLUE,
    itemStyle: { borderColor: '#fff', borderWidth: 1, borderRadius: [4, 4, 0, 0] },
  }],
}))

// ── neglect ──
const hasAnyStrength = computed(() => dataset.data.workouts.length > 0)
const groupNeglect = computed(() => neglectedGroups(dataset.data.workouts, dataset.data.moves, Date.now()))
const staleMoves = computed(() => neglectedMoves(dataset.data.workouts, dataset.data.moves, Date.now()))

// ── year in numbers / weekly activity minutes ──
const yearStats = computed(() =>
  yearInNumbers(dataset.data.workouts, dataset.data.hiit_workouts, dataset.data.run_workouts, Date.now()))
const yearHasData = computed(() => {
  const y = yearStats.value
  return y.strengthSessions + y.hiitSessions + y.runSessions > 0
})

const activityMinutes = computed(() =>
  weeklyActivityMinutes(
    dataset.data.workouts, dataset.data.hiit_workouts, dataset.data.run_workouts, sinceMs.value, Date.now()))

const activityMinutesOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { bottom: 0 },
  grid: { left: 44, right: 16, top: 16, bottom: 52 },
  xAxis: { type: 'category', data: activityMinutes.value.labels, ...axisStyle },
  yAxis: { type: 'value', name: 'min', ...axisStyle },
  series: [
    { name: 'Strength', type: 'bar', stack: 'act', data: activityMinutes.value.strength, color: BLUE, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    { name: 'HIIT', type: 'bar', stack: 'act', data: activityMinutes.value.hiit, color: AQUA, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    { name: 'Run', type: 'bar', stack: 'act', data: activityMinutes.value.run, color: YELLOW, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
  ],
}))

const frequencyOption = computed(() => {
  const { labels, strength, hiit } = weeklyFrequency(dataset.data.workouts, dataset.data.hiit_workouts, sinceMs.value, Date.now())
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
  const counts = groupComposition(dataset.data.workouts, dataset.data.moves, sinceMs.value)
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        // Contrast-relief rule: direct labels on every slice.
        label: { show: true, formatter: '{b}: {c}', color: '#3c4043' },
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        data: [
          { name: 'Legs', value: counts.LEGS, itemStyle: { color: BLUE } },
          { name: 'Push', value: counts.PUSH, itemStyle: { color: AQUA } },
          { name: 'Pull', value: counts.PULL, itemStyle: { color: YELLOW } },
        ],
      },
    ],
  }
})

const runBreakdown = computed(() => activityBreakdown(dataset.data.run_workouts, sinceMs.value))

const activityLabel = (a: string) =>
  a === 'walking' ? 'Walking' : a === 'treadmill' ? 'Treadmill' : a === 'running' ? 'Running' : a

function formatBreakdownDuration(s: number) {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

const runDistanceOption = computed(() => {
  const { labels, values } = weeklyRunDistance(dataset.data.run_workouts, sinceMs.value, Date.now())
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [{ type: 'line', data: values, color: YELLOW, lineStyle: { width: 2 }, symbolSize: 8, areaStyle: { opacity: 0.08 } }],
  }
})

const routeOptions = computed(() => routeTags(dataset.data.run_workouts))
const selectedRoute = ref<string | null>(null)
watch(routeOptions, (opts) => {
  if (!selectedRoute.value && opts.length) selectedRoute.value = opts[0]
}, { immediate: true })

const attempts = computed(() =>
  selectedRoute.value ? routeAttempts(dataset.data.run_workouts, selectedRoute.value) : [])
const bestAttempt = computed(() =>
  attempts.value.length ? attempts.value.reduce((a, b) => (b.duration_s < a.duration_s ? b : a)) : null)

const routeOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 48, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: { type: 'value', name: 'min', scale: true, ...axisStyle },
  series: [{
    type: 'line',
    data: attempts.value.map((a) => [a.started_at, +(a.duration_s / 60).toFixed(1)]),
    color: BLUE,
    lineStyle: { width: 2 },
    symbolSize: 8,
  }],
}))

function formatRunTime(seconds: number) {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

function formatRunPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '–:––'
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`
}

// ── HIIT ──
const hiitOption = computed(() => {
  const { labels, work, rest: restMin } = hiitWorkRest(dataset.data.hiit_workouts, sinceMs.value, Date.now())
  const totals = weeklyHiitMinutes(dataset.data.hiit_workouts, sinceMs.value, Date.now())
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 36, right: 16, top: 16, bottom: 52 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', name: 'min', ...axisStyle },
    series: [
      { name: 'Work', type: 'bar', stack: 'hiit', data: work, color: BLUE, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      { name: 'Rest', type: 'bar', stack: 'hiit', data: restMin, color: YELLOW, itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      { name: 'Total', type: 'line', data: totals.values, color: AQUA, lineStyle: { width: 2 }, symbolSize: 6 },
    ],
  }
})

const longestHiitSession = computed(() => longestHiit(dataset.data.hiit_workouts))
const hiitMoveSeconds = computed(() =>
  hiitWorkSecondsPerMove(dataset.data.hiit_workouts, sinceMs.value).slice(0, 5))

// ── run analytics ──
const activityOptions = computed(() => {
  const present = new Set(dataset.data.run_workouts.filter((r) => r.distance_m > 0).map((r) => r.activity_type || 'running'))
  return ['running', 'walking', 'treadmill'].filter((a) => present.has(a))
})
const selectedActivity = ref<string | null>(null)
watch(activityOptions, (opts) => {
  if ((!selectedActivity.value || !opts.includes(selectedActivity.value)) && opts.length) {
    selectedActivity.value = opts[0]
  }
}, { immediate: true })

const pacePoints = computed(() =>
  selectedActivity.value ? paceTrend(dataset.data.run_workouts, selectedActivity.value) : [])

const paceOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    formatter: (params: Array<{ value: [number, number] }>) => {
      const [t, pace] = params[0]!.value
      return `${new Date(t).toLocaleDateString()} — ${formatRunTime(pace)} /km`
    },
  },
  grid: { left: 48, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'time', ...axisStyle },
  yAxis: {
    type: 'value',
    name: 'min/km',
    scale: true,
    axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => formatRunTime(v) },
    axisLine: axisStyle.axisLine,
    splitLine: axisStyle.splitLine,
  },
  series: [{
    type: 'line',
    data: pacePoints.value.map(([t, p]) => [t, Math.round(p)]),
    color: BLUE,
    lineStyle: { width: 2 },
    symbolSize: 8,
  }],
}))

const bestKm = computed(() => fastestKm(dataset.data.run_workouts))
const maxRun = computed(() => longestRun(dataset.data.run_workouts))
const negSplits = computed(() => negativeSplitShare(dataset.data.run_workouts))
const treadmill = computed(() => treadmillShare(dataset.data.run_workouts, sinceMs.value))
const milestones = computed(() => runMilestones(dataset.data.run_workouts, Date.now()))

const runRecords = computed(() =>
  [...dataset.data.run_records].sort((a, b) => a.distance_km - b.distance_km))

function formatRecordTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

const zoneRows = computed(() => paceZones(dataset.data.run_workouts, sinceMs.value))
const hasPaceZones = computed(() => zoneRows.value.some((z) => z.minutes > 0))

const paceZoneOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 44, right: 16, top: 16, bottom: 28 },
  xAxis: { type: 'category', data: zoneRows.value.map((z) => z.label), ...axisStyle },
  yAxis: { type: 'value', name: 'min', ...axisStyle },
  series: [{
    type: 'bar',
    data: zoneRows.value.map((z) => +z.minutes.toFixed(1)),
    color: YELLOW,
    itemStyle: { borderColor: '#fff', borderWidth: 1, borderRadius: [4, 4, 0, 0] },
  }],
}))

const heatmapRoutes = computed<RunPoint[][]>(() =>
  [...dataset.data.run_workouts]
    .sort((a, b) => b.started_at - a.started_at)
    .flatMap((r) => (r.points && r.points.length >= 2 ? [r.points] : []))
    .slice(0, 50))
</script>
